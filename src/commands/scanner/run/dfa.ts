import {Flags} from '@salesforce/sf-plugins-core';
import {ScannerRunCommand} from '../../../lib/ScannerRunCommand';
import {InputProcessor, InputProcessorImpl} from "../../../lib/InputProcessor";
import {EngineOptionsFactory, RunDfaEngineOptionsFactory} from "../../../lib/EngineOptionsFactory";
import {BundleName, getMessage} from "../../../MessageCatalog";
import {Logger} from "@salesforce/core";
import {Display} from "../../../lib/Display";
import {Action} from "../../../lib/ScannerCommand";
import {RunDfaAction} from "../../../lib/actions/RunDfaAction";
import {RuleFilterFactory, RuleFilterFactoryImpl} from "../../../lib/RuleFilterFactory";
import {ResultsProcessorFactory, ResultsProcessorFactoryImpl} from "../../../lib/output/ResultsProcessorFactory";

/**
 * Defines the "run dfa" command for the "scanner" cli.
 */
export default class Dfa extends ScannerRunCommand {
	// These determine what's displayed when the --help/-h flag is provided.
	public static summary = getMessage(BundleName.RunDfa, 'commandSummary');
	public static description = getMessage(BundleName.RunDfa, 'commandDescription');
	public static examples = [
		getMessage(BundleName.RunDfa, 'examples')
	];
	public static readonly invocation = 'scanner run dfa';

	// This defines the flags accepted by this command.
	// NOTE: Unlike the other classes that extend ScannerCommand, this class has no flags for specifying rules. This is
	// because the command currently supports only a single engine with a single rule. So no such flags are currently
	// needed. If, at some point, we add additional rules or engines to this command, those flags will need to be added.
	public static readonly flags = {
		// Include all common flags from the super class.
		...ScannerRunCommand.flags,
		// BEGIN: Filter-related flags.
		'with-pilot': Flags.boolean({
			summary: getMessage(BundleName.RunDfa, 'flags.withpilotSummary')
		}),
		// END: Filter-related flags.
		// BEGIN: Flags for targeting files.
		// NOTE: All run commands have a `--target` flag, but they have differing functionalities,
		// and therefore different descriptions, so each command defines this flag separately.
		target: Flags.custom<string[]>({
			char: 't',
			summary: getMessage(BundleName.RunDfa, 'flags.targetSummary'),
			description: getMessage(BundleName.RunDfa, 'flags.targetDescription'),
			delimiter: ',',
			multiple: true
		})(),
		// END: Flags for targeting files.
		// BEGIN: Config-overrideable engine flags.
		'rule-thread-count': Flags.integer({
			summary: getMessage(BundleName.RunDfa, 'flags.rulethreadcountSummary'),
			env: 'SFGE_RULE_THREAD_COUNT'
		}),
		'rule-thread-timeout': Flags.integer({
			summary: getMessage(BundleName.RunDfa, 'flags.rulethreadtimeoutSummary'),
			env: 'SFGE_RULE_THREAD_TIMEOUT'
		}),
		// NOTE: This flag can't use the `env` property to inherit a value automatically, because OCLIF boolean flags
		// don't support that. Instead, we check the env-var manually in a subsequent method.
		'rule-disable-warning-violation': Flags.boolean({
			summary: getMessage(BundleName.RunDfa, 'flags.ruledisablewarningviolationSummary'),
			description: getMessage(BundleName.RunDfa, 'flags.ruledisablewarningviolationDescription')
		}),
		'sfgejvmargs': Flags.string({
			summary: getMessage(BundleName.RunDfa, 'flags.sfgejvmargsSummary'),
			description: getMessage(BundleName.RunDfa, 'flags.sfgejvmargsDescription'),
			env: 'SFGE_JVM_ARGS'
		}),
		'pathexplimit': Flags.integer({
			summary: getMessage(BundleName.RunDfa, 'flags.pathexplimitSummary'),
			description: getMessage(BundleName.RunDfa, 'flags.pathexplimitDescription'),
			env: 'SFGE_PATH_EXPANSION_LIMIT'
		})
		// END: Config-overrideable engine flags.
	};

	protected createAction(logger: Logger, display: Display): Action {
		const inputProcessor: InputProcessor = new InputProcessorImpl(this.config.version, display);
		const ruleFilterFactory: RuleFilterFactory = new RuleFilterFactoryImpl();
		const engineOptionsFactory: EngineOptionsFactory = new RunDfaEngineOptionsFactory(inputProcessor);
		const resultsProcessorFactory: ResultsProcessorFactory = new ResultsProcessorFactoryImpl();
		return new RunDfaAction(logger, display, inputProcessor, ruleFilterFactory, engineOptionsFactory,
			resultsProcessorFactory);
	}
}
