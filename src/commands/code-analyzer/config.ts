import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import {ConfigAction, ConfigDependencies, ConfigInput} from '../../lib/actions/ConfigAction.js';
import {ConfigFileWriter} from '../../lib/writers/ConfigWriter.js';
import {ConfigStyledYamlViewer} from '../../lib/viewers/ConfigViewer.js';
import {ConfigActionSummaryViewer} from '../../lib/viewers/ActionSummaryViewer.js';
import {CodeAnalyzerConfigFactoryImpl} from '../../lib/factories/CodeAnalyzerConfigFactory.js';
import {EnginePluginsFactoryImpl} from '../../lib/factories/EnginePluginsFactory.js';
import {BundleName, getMessage, getMessages} from '../../lib/messages.js';
import {LogEventDisplayer} from '../../lib/listeners/LogEventListener.js';
import {RuleSelectionProgressSpinner} from '../../lib/listeners/ProgressEventListener.js';
import {Displayable, UxDisplay} from '../../lib/Display.js';

export default class ConfigCommand extends SfCommand<void> implements Displayable {
	// We don't need the `--json` output for this command.
	public static readonly enableJsonFlag = false;
	public static readonly summary = getMessage(BundleName.ConfigCommand, 'command.summary');
	public static readonly description = getMessage(BundleName.ConfigCommand, 'command.description');
	public static readonly examples = getMessages(BundleName.ConfigCommand, 'command.examples');

	public static readonly flags = {
		workspace: Flags.string({
			summary: getMessage(BundleName.ConfigCommand, 'flags.workspace.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.workspace.description'),
			char: 'w',
			multiple: true,
			delimiter: ','
		}),
		target: Flags.string({
			summary: getMessage(BundleName.ConfigCommand, 'flags.target.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.target.description'),
			char: 't',
			multiple: true,
			delimiter: ','
		}),
		'rule-selector': Flags.string({
			summary: getMessage(BundleName.ConfigCommand, 'flags.rule-selector.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.rule-selector.description'),
			char: 'r',
			multiple: true,
			default: ["all"]
		}),
		'config-file': Flags.file({
			summary: getMessage(BundleName.ConfigCommand, 'flags.config-file.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.config-file.description'),
			char: 'c',
			exists: true
		}),
		'output-file': Flags.string({
			summary: getMessage(BundleName.ConfigCommand, 'flags.output-file.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.output-file.description'),
			char: 'f'
		}),
		'include-unmodified-rules': Flags.boolean({
			summary: getMessage(BundleName.ConfigCommand, 'flags.include-unmodified-rules.summary'),
			description: getMessage(BundleName.ConfigCommand, 'flags.include-unmodified-rules.description')
		})
	};

	public async run(): Promise<void> {
		const parsedFlags = (await this.parse(ConfigCommand)).flags;
		const dependencies: ConfigDependencies = this.createDependencies(parsedFlags['output-file']);
		const action: ConfigAction = ConfigAction.createAction(dependencies);
		const configInput: ConfigInput = {
			...parsedFlags,
			'rule-selector': parsedFlags['rule-selector'].flatMap(s => s.replace(/\s+/g, ' ').trim().split(' '))
		};
		await action.execute(configInput);
	}

	protected createDependencies(outputFile?: string): ConfigDependencies {
		const uxDisplay: UxDisplay = new UxDisplay(this, this.spinner);
		const dependencies: ConfigDependencies = {
			configFactory: new CodeAnalyzerConfigFactoryImpl(),
			pluginsFactory: new EnginePluginsFactoryImpl(),
			logEventListeners: [new LogEventDisplayer(uxDisplay)],
			progressEventListeners: [new RuleSelectionProgressSpinner(uxDisplay)],
			actionSummaryViewer: new ConfigActionSummaryViewer(uxDisplay),
			viewer: new ConfigStyledYamlViewer(uxDisplay)
		};
		if (outputFile) {
			dependencies.writer = ConfigFileWriter.fromFile(outputFile, uxDisplay);
		}
		return dependencies;
	}
}
