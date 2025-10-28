import {CodeAnalyzerConfig, CodeAnalyzer} from '@salesforce/code-analyzer-core';
import {EnginePlugin} from '@salesforce/code-analyzer-engine-api';
import {CodeAnalyzerConfigFactory} from '../factories/CodeAnalyzerConfigFactory.js';
import {EnginePluginsFactory} from '../factories/EnginePluginsFactory.js';
import {ConfigWriter} from '../writers/ConfigWriter.js';
import {LogFileWriter} from '../writers/LogWriter.js';
import {ConfigViewer} from '../viewers/ConfigViewer.js';
import {createWorkspace} from '../utils/WorkspaceUtil.js';
import {LogEventListener, LogEventLogger} from '../listeners/LogEventListener.js';
import {ProgressEventListener} from '../listeners/ProgressEventListener.js';
import {ConfigActionSummaryViewer} from '../viewers/ActionSummaryViewer.js';
import {AnnotatedConfigModel, ConfigModel} from '../models/ConfigModel.js';

export type ConfigDependencies = {
	configFactory: CodeAnalyzerConfigFactory;
	pluginsFactory: EnginePluginsFactory;
	logEventListeners: LogEventListener[];
	progressEventListeners: ProgressEventListener[];
	writer?: ConfigWriter;
	actionSummaryViewer: ConfigActionSummaryViewer;
	viewer: ConfigViewer;
};

export type ConfigInput = {
	'config-file'?: string;
	'output-file'?: string;
	'rule-selector': string[];
	workspace?: string[];
	target?: string[];
	'include-unmodified-rules'?: boolean
};

export class ConfigAction {
	private readonly dependencies: ConfigDependencies;

	private constructor(dependencies: ConfigDependencies) {
		this.dependencies = dependencies;
	}

	public async execute(input: ConfigInput): Promise<void> {

		// ==== PREPARE USER's CONFIG AND USER's CODE ANALYZER =========================================================
		const userConfig: CodeAnalyzerConfig = this.dependencies.configFactory.create(input['config-file']);

		// We always add a Logger Listener to the appropriate listeners list, because we should always be logging.
		const logFileWriter: LogFileWriter = await LogFileWriter.fromConfig(userConfig);
		this.dependencies.actionSummaryViewer.viewPreExecutionSummary(logFileWriter.getLogDestination());
		const logEventLogger: LogEventLogger = new LogEventLogger(logFileWriter);
		this.dependencies.logEventListeners.push(logEventLogger);

		const userCore: CodeAnalyzer = new CodeAnalyzer(userConfig);

		// LogEventListeners should start listening as soon as the User Core is instantiated, since it can start emitting
		// relevant events basically immediately.
		this.dependencies.logEventListeners.forEach(listener => listener.listen(userCore));

		const enginePlugins: EnginePlugin[] = this.dependencies.pluginsFactory.create();
		const enginePluginModules: string[] = userConfig.getCustomEnginePluginModules();

		const userEnginePromises: Promise<void>[] = [
			...enginePlugins.map(enginePlugin => userCore.addEnginePlugin(enginePlugin)),
			...enginePluginModules.map(pluginModule => userCore.dynamicallyAddEnginePlugin(pluginModule)),
		];
		await Promise.all(userEnginePromises);


		// ==== PREPARE DEFAULT CONFIG (with disable_engine settings kept) AND DEFAULT CODE ANALYZER ===================

		// TODO: We are currently only passing in the enginePlugins here which are not all plugins. We need to
		// include the dynamically loaded plugins... but dynamicallyAddEnginePlugin loads and adds and so we never get
		// access to the plugins. We need to update core to separate the concerns so that we just have a
		// dynamicallyLoadEnginePlugin to just return the plugin so that we can add these plugins to this list.
		// And/Or we could just have the Code Analyzer class return a list of the engines that were disabled so that
		// we don't need this helper function here.
		const disabledEngines: string[] = getDisabledEngineNames(enginePlugins, new Set(userCore.getEngineNames()));

		type engineDisableInfo = { engines: { [key: string]: { disable_engine: boolean } } };
		const rawConfigOnlyWithEnginesDisabled: engineDisableInfo = {engines: {}};
		for (const engineName of disabledEngines) {
			rawConfigOnlyWithEnginesDisabled.engines[engineName] = { disable_engine: true };
		}
		const defaultConfigWithEnginesDisabled: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject(rawConfigOnlyWithEnginesDisabled);

		// The Default config produces two Cores, since we have to run two selections.
		const defaultCoreForAllRules: CodeAnalyzer = new CodeAnalyzer(defaultConfigWithEnginesDisabled);
		const defaultCoreForSelectRules: CodeAnalyzer = new CodeAnalyzer(defaultConfigWithEnginesDisabled);

		const defaultEnginePromises: Promise<void>[] = [
			...enginePlugins.map(enginePlugin => defaultCoreForAllRules.addEnginePlugin(enginePlugin)),
			...enginePlugins.map(enginePlugin => defaultCoreForSelectRules.addEnginePlugin(enginePlugin)),
			// Assumption: Every engine's default configuration is sufficient to allow that engine to be instantiated,
			// or throw a clear error indicating the problem.
			...enginePluginModules.map(pluginModule => defaultCoreForAllRules.dynamicallyAddEnginePlugin(pluginModule)),
			...enginePluginModules.map(pluginModule => defaultCoreForSelectRules.dynamicallyAddEnginePlugin(pluginModule)),
		];
		await Promise.all(defaultEnginePromises);


		// ==== PERFORM RULE SELECTIONS ================================================================================
		const workspace: string[]|undefined = input.workspace || (input.target ? ['.'] : undefined);
		const userSelectOptions = workspace
			? {workspace: await createWorkspace(userCore, workspace, input.target)}
			: undefined;
		const defaultSelectOptionsForAllRules = workspace
			? {workspace: await createWorkspace(defaultCoreForAllRules, workspace, input.target)}
			: undefined;
		const defaultSelectOptionsForSelectRules = workspace
			? {workspace: await createWorkspace(defaultCoreForSelectRules, workspace, input.target)}
			: undefined;

		// EngineProgressListeners should start listening right before we call the Cores' `.selectRules()` methods, since
		// that's when progress events can start being emitted.
		this.dependencies.progressEventListeners.forEach(listener => listener.listen(userCore, defaultCoreForAllRules, defaultCoreForSelectRules));

		const [userRules, allDefaultRules, selectedDefaultRules] = await Promise.all([
			// The user Core should respect the user's selection criteria.
			userCore.selectRules(input['rule-selector'], userSelectOptions),
			// One of the Default Cores should always use "all", to minimize the likelihood of a rule's default state
			// being unavailable for comparison.
			defaultCoreForAllRules.selectRules(['all'], defaultSelectOptionsForAllRules),
			// One of the Default Cores should use the same selectors as the User Core, so we know what rules are available
			// by default.
			defaultCoreForSelectRules.selectRules(input['rule-selector'], defaultSelectOptionsForSelectRules)
		]);

		// After the Cores are done running, the listeners need to be told to stop, since some of them have persistent UI
		// elements or file handlers that must be gracefully ended.
		this.dependencies.progressEventListeners.forEach(listener => listener.stopListening());
		this.dependencies.logEventListeners.forEach(listener => listener.stopListening());


		// ==== CREATE AND WRITE CONFIG YAML ===========================================================================

		// We need the Set of disabled engines plus all engines that returned rules for the user's selection on both the
		// Default and User Cores.
		const relevantEngines: Set<string> = new Set([
			...disabledEngines,
			...userRules.getEngineNames(),
			...selectedDefaultRules.getEngineNames()]);

		const includeUnmodifiedRules: boolean = input["include-unmodified-rules"] ?? false;
		const configModel: ConfigModel = new AnnotatedConfigModel(userCore, userRules, allDefaultRules, relevantEngines, includeUnmodifiedRules);

		const fileWritten: boolean = this.dependencies.writer
			? await this.dependencies.writer.write(configModel)
			: false;
		if (!fileWritten) {
			this.dependencies.viewer.view(configModel);
		}

		this.dependencies.actionSummaryViewer.viewPostExecutionSummary(logFileWriter.getLogDestination(), fileWritten ? input['output-file'] : undefined);
		return Promise.resolve();
	}

	public static createAction(dependencies: ConfigDependencies): ConfigAction {
		return new ConfigAction(dependencies)
	}
}

function getDisabledEngineNames(allEnginePlugins: EnginePlugin[], enabledEngineNames: Set<string>): string[] {
	return allEnginePlugins.flatMap(enginePlugin =>
		enginePlugin.getAvailableEngineNames().filter(engineName => !enabledEngineNames.has(engineName))
	);
}
