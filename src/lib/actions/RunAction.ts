import {SfError} from '@salesforce/core';
import {
	CodeAnalyzer,
	CodeAnalyzerConfig,
	RuleSelection,
	RunOptions,
	RunResults,
	SeverityLevel,
	Workspace
} from '@salesforce/code-analyzer-core';
import {CodeAnalyzerConfigFactory} from '../factories/CodeAnalyzerConfigFactory.js';
import {EnginePluginsFactory} from '../factories/EnginePluginsFactory.js';
import {createWorkspace} from '../utils/WorkspaceUtil.js';
import {ResultsViewer} from '../viewers/ResultsViewer.js';
import {RunActionSummaryViewer} from '../viewers/ActionSummaryViewer.js';
import {ResultsWriter} from '../writers/ResultsWriter.js';
import {LogFileWriter} from '../writers/LogWriter.js';
import {LogEventListener, LogEventLogger} from '../listeners/LogEventListener.js';
import {ProgressEventListener} from '../listeners/ProgressEventListener.js';
import {BundleName, getMessage} from '../messages.js';
import {TelemetryEmitter} from '../Telemetry.js';
import {TelemetryEventListener} from '../listeners/TelemetryEventListener.js';
import * as Constants from '../../Constants.js';

export type RunDependencies = {
	configFactory: CodeAnalyzerConfigFactory;
	pluginsFactory: EnginePluginsFactory;
	logEventListeners: LogEventListener[];
	progressListeners: ProgressEventListener[];
	telemetryEmitter: TelemetryEmitter;
	writer: ResultsWriter;
	resultsViewer: ResultsViewer;
	actionSummaryViewer: RunActionSummaryViewer;
}

export type RunInput = {
	'config-file'?: string;
	'output-file': string[];
	'rule-selector': string[];
	'severity-threshold'?: SeverityLevel;
	target?: string[];
	workspace: string[];

}

export class RunAction {
	private readonly dependencies: RunDependencies;

	private constructor(dependencies: RunDependencies) {
		this.dependencies = dependencies;
	}

	public async execute(input: RunInput): Promise<void> {
		const config: CodeAnalyzerConfig = this.dependencies.configFactory.create(input['config-file']);
		const logWriter: LogFileWriter = await LogFileWriter.fromConfig(config);
		this.dependencies.actionSummaryViewer.viewPreExecutionSummary(logWriter.getLogDestination());
		// We always add a Logger Listener to the appropriate listeners list, because we should Always Be Logging.
		this.dependencies.logEventListeners.push(new LogEventLogger(logWriter));
		const core: CodeAnalyzer = new CodeAnalyzer(config);
		// LogEventListeners should start listening as soon as the Core is instantiated, since Core can start emitting
		// events they listen for basically immediately.
		this.dependencies.logEventListeners.forEach(listener => listener.listen(core));
		const telemetryListener: TelemetryEventListener = new TelemetryEventListener(this.dependencies.telemetryEmitter);
		telemetryListener.listen(core);
		const enginePlugins = this.dependencies.pluginsFactory.create();
		const enginePluginModules = config.getCustomEnginePluginModules();
		const addEnginePromises: Promise<void>[] = [
			...enginePlugins.map(enginePlugin => core.addEnginePlugin(enginePlugin)),
			...enginePluginModules.map(pluginModule => core.dynamicallyAddEnginePlugin(pluginModule))
		];
		await Promise.all(addEnginePromises);
		const workspace: Workspace = await createWorkspace(core, input.workspace, input.target);

		// EngineProgressListeners should start listening right before we call Core's `.selectRules()` method, since
		// that's when progress events can start being emitted.
		this.dependencies.progressListeners.forEach(listener => listener.listen(core));
		const ruleSelection: RuleSelection = await core.selectRules(input['rule-selector'], {workspace});
		const runOptions: RunOptions = {workspace};
		const results: RunResults = await core.run(ruleSelection, runOptions);
		this.emitEngineTelemetry(ruleSelection, results, enginePlugins.flatMap(p => p.getAvailableEngineNames()));
		// After Core is done running, the listeners need to be told to stop, since some of them have persistent UI elements
		// or file handlers that must be gracefully ended.
		this.dependencies.progressListeners.forEach(listener => listener.stopListening());
		this.dependencies.logEventListeners.forEach(listener => listener.stopListening());
		telemetryListener.stopListening();
		this.dependencies.writer.write(results);
		this.dependencies.resultsViewer.view(results);
		this.dependencies.actionSummaryViewer.viewPostExecutionSummary(results, logWriter.getLogDestination(), input['output-file']);

		const thresholdValue = input['severity-threshold'];
		if (thresholdValue) {
			throwErrorIfSevThresholdExceeded(thresholdValue, results);
		}
	}

	public static createAction(dependencies: RunDependencies): RunAction {
		return new RunAction(dependencies);
	}

	private emitEngineTelemetry(ruleSelection: RuleSelection, results: RunResults, coreEngineNames: string[]): void {
		const selectedEngineNames: Set<string> = new Set(ruleSelection.getEngineNames());
		for (const coreEngineName of coreEngineNames) {
			if (!selectedEngineNames.has(coreEngineName)) {
				continue;
			}
			this.dependencies.telemetryEmitter.emitTelemetry(Constants.TelemetrySource, Constants.TelemetryEventName, {
				sfcaEvent: Constants.CliTelemetryEvents.ENGINE_SELECTION,
				engine: coreEngineName,
				ruleCount: ruleSelection.getRulesFor(coreEngineName).length
			});

			this.dependencies.telemetryEmitter.emitTelemetry(Constants.TelemetrySource, Constants.TelemetryEventName, {
				sfcaEvent: Constants.CliTelemetryEvents.ENGINE_EXECUTION,
				engine: coreEngineName,
				violationCount: results.getEngineRunResults(coreEngineName).getViolationCount()
			});
		}
	}
}

function throwErrorIfSevThresholdExceeded(threshold: SeverityLevel, results: RunResults): void {
	let exceedingCount = 0;
	let mostIntenseSeverity = Number.MAX_SAFE_INTEGER;
	for (let i: number = threshold; i > 0; i--) {
		const sevCount = results.getViolationCountOfSeverity(i);
		if (sevCount > 0) {
			exceedingCount += sevCount;
			mostIntenseSeverity = i;
		}
	}
	if (exceedingCount > 0) {
		const message = getMessage(BundleName.RunAction, 'error.severity-threshold-exceeded', [exceedingCount, SeverityLevel[threshold]]);
		// Use an SfError because we can easily set an exit code, and it will know what to do with that.
		throw new SfError(message, 'ThresholdExceeded', [], mostIntenseSeverity);
	}
}
