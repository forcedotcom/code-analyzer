import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import {View} from '../../Constants';
import {CodeAnalyzerConfigFactoryImpl} from '../../lib/factories/CodeAnalyzerConfigFactory';
import {EnginePluginsFactoryImpl} from '../../lib/factories/EnginePluginsFactory';
import {RuleDetailDisplayer, RulesNoOpDisplayer, RuleTableDisplayer} from '../../lib/viewers/RuleViewer';
import {RulesActionSummaryViewer} from '../../lib/viewers/ActionSummaryViewer';
import {RulesAction, RulesDependencies, RulesInput} from '../../lib/actions/RulesAction';
import {BundleName, getMessage, getMessages} from '../../lib/messages';
import {Displayable, UxDisplay} from '../../lib/Display';
import {LogEventDisplayer} from '../../lib/listeners/LogEventListener';
import {RuleSelectionProgressSpinner} from '../../lib/listeners/ProgressEventListener';
import {CompositeRulesWriter} from '../../lib/writers/RulesWriter';
import { SfCliTelemetryEmitter } from '../../lib/Telemetry';

export default class RulesCommand extends SfCommand<void> implements Displayable {
	// We don't need the `--json` output for this command.
	public static readonly enableJsonFlag = false;
	public static readonly summary = getMessage(BundleName.RulesCommand, 'command.summary');
	public static readonly description = getMessage(BundleName.RulesCommand, 'command.description');
	public static readonly examples = getMessages(BundleName.RulesCommand, 'command.examples');

	public static readonly flags = {
		workspace: Flags.string({
			summary: getMessage(BundleName.RulesCommand, 'flags.workspace.summary'),
			description: getMessage(BundleName.RulesCommand, 'flags.workspace.description'),
			char: 'w',
			multiple: true,
			delimiter: ',',
		}),
		target: Flags.string({
			summary: getMessage(BundleName.RulesCommand, 'flags.target.summary'),
			description: getMessage(BundleName.RulesCommand,'flags.target.description'),
			char: 't',
			multiple: true,
			delimiter: ','
		}),
		'rule-selector': Flags.string({
			summary: getMessage(BundleName.RulesCommand, 'flags.rule-selector.summary'),
			description: getMessage(BundleName.RulesCommand, 'flags.rule-selector.description'),
			char: 'r',
			multiple: true,
			delimiter: ',',
			default: ["Recommended"]
		}),
		'config-file': Flags.file({
			summary: getMessage(BundleName.RulesCommand, 'flags.config-file.summary'),
			description: getMessage(BundleName.RulesCommand, 'flags.config-file.description'),
			char: 'c',
			exists: true
		}),
		'output-file': Flags.string({
			summary: getMessage(BundleName.RulesCommand, 'flags.output-file.summary'),
			description: getMessage(BundleName.RulesCommand, 'flags.output-file.description'),
			char: 'f',
			multiple: true,
			delimiter: ','
		}),
		view: Flags.string({
			summary: getMessage(BundleName.RulesCommand, 'flags.view.summary'),
			description: getMessage(BundleName.RulesCommand, 'flags.view.description'),
			char: 'v',
			options: Object.values(View)
		})
	};

	public async run(): Promise<void> {
		const parsedFlags = (await this.parse(RulesCommand)).flags;
		const outputFiles = parsedFlags['output-file'] ?? [];
		const view = parsedFlags.view as View | undefined;

		const dependencies: RulesDependencies = this.createDependencies(view, outputFiles);
		const action: RulesAction = RulesAction.createAction(dependencies);

		const rulesInput: RulesInput = {
			'config-file': parsedFlags['config-file'],
			'output-file': outputFiles,
			'rule-selector': parsedFlags['rule-selector'],
			'workspace': parsedFlags['workspace'],
			'target': parsedFlags['target']
		};

		await action.execute(rulesInput);
	}

	protected createDependencies(view: View | undefined, outputFiles: string[]): RulesDependencies {
		const uxDisplay: UxDisplay = new UxDisplay(this, this.spinner);
		const dependencies: RulesDependencies = {
			configFactory: new CodeAnalyzerConfigFactoryImpl(),
			pluginsFactory: new EnginePluginsFactoryImpl(),
			logEventListeners: [new LogEventDisplayer(uxDisplay)],
			progressListeners: [new RuleSelectionProgressSpinner(uxDisplay)],
			telemetryEmitter: new SfCliTelemetryEmitter(),
			actionSummaryViewer: new RulesActionSummaryViewer(uxDisplay),
			viewer: this.createRulesViewer(view, outputFiles, uxDisplay),
			writer: CompositeRulesWriter.fromFiles(outputFiles)
		};

		return dependencies;
	}

	/**
	 * Creates the {@link RuleViewer} that will be called from {@link RulesAction.execute} to display rules.
	 * If a view option is set, rules will be displayed in the specified format.
	 * If an output file is set, rules will not display.
	 * By default, the details display will be used.
	 */
	private createRulesViewer(view: View | undefined, outputFiles: string[] = [], uxDisplay: UxDisplay) {
		if (view === View.DETAIL) {
			return new RuleDetailDisplayer(uxDisplay);
		} else if (view === View.TABLE) {
			return new RuleTableDisplayer(uxDisplay);
		} else if (outputFiles.length > 0) {
			return new RulesNoOpDisplayer();
		}

		return new RuleTableDisplayer(uxDisplay);
	}
}

