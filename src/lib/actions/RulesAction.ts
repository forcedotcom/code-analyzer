import {CodeAnalyzer, CodeAnalyzerConfig, Rule, RuleSelection} from '@salesforce/code-analyzer-core';
import {CodeAnalyzerConfigFactory} from '../factories/CodeAnalyzerConfigFactory.js';
import {EnginePluginsFactory} from '../factories/EnginePluginsFactory.js';
import {LogEventListener, LogEventLogger} from '../listeners/LogEventListener.js';
import {ProgressEventListener} from '../listeners/ProgressEventListener.js';
import {createWorkspace} from '../utils/WorkspaceUtil.js';
import {RulesActionSummaryViewer} from '../viewers/ActionSummaryViewer.js';
import {RuleViewer} from '../viewers/RuleViewer.js';
import {LogFileWriter} from '../writers/LogWriter.js';
import {RulesWriter} from '../writers/RulesWriter.js';
import {TelemetryEmitter} from '../Telemetry.js';
import {TelemetryEventListener} from '../listeners/TelemetryEventListener.js';
import * as Constants from '../../Constants.js';

export type RulesDependencies = {
	configFactory: CodeAnalyzerConfigFactory;
	pluginsFactory: EnginePluginsFactory;
	logEventListeners: LogEventListener[];
	progressListeners: ProgressEventListener[];
	telemetryEmitter: TelemetryEmitter;
	actionSummaryViewer: RulesActionSummaryViewer,
	viewer: RuleViewer;
	writer: RulesWriter;
}

export type RulesInput = {
	'config-file'?: string;
	'rule-selector': string[];
	'output-file'?: string[];
	workspace?: string[];
	target?: string[];
	view?: string;
}

export class RulesAction {
	private readonly dependencies: RulesDependencies;

	private constructor(dependencies: RulesDependencies) {
		this.dependencies = dependencies;
	}

	public async execute(input: RulesInput): Promise<void> {
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
		const workspace: string[]|undefined = input.workspace || (input.target ? ['.'] : undefined);
		const selectOptions = workspace
			? {workspace: await createWorkspace(core, workspace, input.target)}
			: undefined;
		// EngineProgressListeners should start listening right before we call Core's `.selectRules()` method, since
		// that's when progress events can start being emitted.
		this.dependencies.progressListeners.forEach(listener => listener.listen(core));
		const ruleSelection: RuleSelection = await core.selectRules(input["rule-selector"], selectOptions);
		this.emitEngineTelemetry(ruleSelection, enginePlugins.flatMap(p => p.getAvailableEngineNames()));
		// After Core is done running, the listeners need to be told to stop, since some of them have persistent UI elements
		// or file handlers that must be gracefully ended.
		this.dependencies.progressListeners.forEach(listener => listener.stopListening());
		this.dependencies.logEventListeners.forEach(listener => listener.stopListening());
		telemetryListener.stopListening();
		const rules: Rule[] = core.getEngineNames().flatMap(name => ruleSelection.getRulesFor(name));

		this.dependencies.writer.write(ruleSelection)
		this.dependencies.viewer.view(rules);

		this.dependencies.actionSummaryViewer.viewPostExecutionSummary(
			ruleSelection,
			logWriter.getLogDestination(),
			input['output-file'] ?? []
		);
	}

	public static createAction(dependencies: RulesDependencies): RulesAction {
		return new RulesAction(dependencies);
	}

	private emitEngineTelemetry(ruleSelection: RuleSelection, coreEngineNames: string[]): void {
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
		}
	}
}
