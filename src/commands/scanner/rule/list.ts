import {flags} from '@salesforce/command';
import {Messages} from '@salesforce/core';
import {Controller} from '../../../Controller';
import {Rule} from '../../../types';
import {ScannerCommand} from '../../../lib/ScannerCommand';
import {AllowedEngineFilters} from '../../../Constants';
import {deepCopy} from '../../../lib/util/Utils';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@salesforce/sfdx-scanner', 'list');
const columns = [messages.getMessage('columnNames.name'),
				messages.getMessage('columnNames.languages'),
				messages.getMessage('columnNames.categories'),
				messages.getMessage('columnNames.rulesets'),
				messages.getMessage('columnNames.engine'),
				messages.getMessage('columnNames.is-dfa'),
				messages.getMessage('columnNames.is-pilot')];
const MSG_YES = messages.getMessage('yes');
const MSG_NO = messages.getMessage('no');

export default class List extends ScannerCommand {
	// These determine what's displayed when the --help/-h flag is supplied.
	public static description = messages.getMessage('commandDescription');
	public static longDescription = messages.getMessage('commandDescriptionLong');

	public static examples = [
		messages.getMessage('examples')
	];

	// This defines the flags accepted by this command. The key is the longname, the char property is the shortname, and description
	// is what's printed when the -h/--help flag is supplied.
	protected static flagsConfig = {
		verbose: flags.builtin(),
		// BEGIN: Flags consumed by ScannerCommand#buildRuleFilters
		// These flags are how you choose which rules are listed.
		category: flags.array({
			char: 'c',
			description: messages.getMessage('flags.categoryDescription'),
			longDescription: messages.getMessage('flags.categoryDescriptionLong')
		}),
		ruleset: flags.array({
			char: 'r',
			deprecated: {
				messageOverride: messages.getMessage('rulesetDeprecation')
			},
			description: messages.getMessage('flags.rulesetDescription'),
			longDescription: messages.getMessage('flags.rulesetDescriptionLong')
		}),
		language: flags.array({
			char: 'l',
			description: messages.getMessage('flags.languageDescription'),
			longDescription: messages.getMessage('flags.languageDescriptionLong')
		}),
		engine: flags.array({
			char: 'e',
			description: messages.getMessage('flags.engineDescription'),
			longDescription: messages.getMessage('flags.engineDescriptionLong'),
			options: [...AllowedEngineFilters]
		})
		// END: Flags consumed by ScannerCommand#buildRuleFilters
	};

	async runInternal(): Promise<Rule[]> {
		const ruleFilters = this.buildRuleFilters();
		// It's possible for this line to throw an error, but that's fine because the error will be an SfdxError that we can
		// allow to boil over.
		const ruleManager = await Controller.createRuleManager();
		const rules = await ruleManager.getRulesMatchingCriteria(ruleFilters);
		const formattedRules = List.formatRulesForDisplay(rules);
		this.ux.table(formattedRules, columns);
		// If the --json flag was used, we need to return a JSON. Since we don't have to worry about displayability, we can
		// just return the filtered list instead of the formatted list.
		return rules;
	}

	private static formatRulesForDisplay(rules: Rule[]): Record<string, string|string[]>[] {
		// Truncate ruleset values
		const rulesetTruncatedRules = List.truncateRulesetValues(rules);

		// Transform column names to match display
		const transformedRules: Record<string, string|string[]>[] = [];
		rulesetTruncatedRules.forEach(rule => transformedRules.push(List.transformKeysToMatchColumns(rule)));

		return transformedRules;
	}

	private static transformKeysToMatchColumns(rule: Rule): Record<string, string|string[]> {
		// Map rule fields to the matching column
		const transformedRule: Record<string, string|string[]> = {};
		transformedRule[columns[0]] = rule.name;
		transformedRule[columns[1]] = rule.languages.join(',');
		transformedRule[columns[2]] = rule.categories.join(',');
		transformedRule[columns[3]] = rule.rulesets.join(',');
		transformedRule[columns[4]] = rule.engine;
		transformedRule[columns[5]] = rule.isDfa ? MSG_YES : MSG_NO;
		transformedRule[columns[6]] = rule.isPilot ? MSG_YES : MSG_NO;
		return transformedRule;
	}

	private static truncateRulesetValues(rules: Rule[]): Rule[] {
		return rules.map(rule => {
			const clonedRule = deepCopy(rule);

			// If any of the rule's rulesets have a name longer than 20 characters, we'll truncate it to 15 and append ellipses,
			// so it doesn't overflow horizontally.
			clonedRule.rulesets = rule['rulesets'].map(ruleset =>
				ruleset.length >= 20 ? ruleset.slice(0, 15) + '...' : ruleset);
			return clonedRule;
		});
	}
}
