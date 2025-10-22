import {Rule, SeverityLevel} from '@salesforce/code-analyzer-core';
import {Display} from '../Display.js';
import {toStyledHeaderAndBody} from '../utils/StylingUtil.js';
import {BundleName, getMessage} from '../messages.js';

export interface RuleViewer {
	view(rules: Rule[]): void;
}

abstract class AbstractRuleDisplayer implements RuleViewer {
	protected display: Display;

	public constructor(display: Display) {
		this.display = display;
	}

	public view(rules: Rule[]): void {
		this.displayLineSeparator();
		if (rules.length > 0) {
			this._view(rules);
			this.displayLineSeparator();
		}
	}

	protected displayLineSeparator(): void {
		this.display.displayLog("");
	}

	protected abstract _view(rules: Rule[]): void;
}

export class RuleDetailDisplayer extends AbstractRuleDisplayer {
	protected _view(rules: Rule[]): void {
		const styledRules: string[] = [];
		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i];
			const header = getMessage(BundleName.RuleViewer, 'summary.detail.header', [i + 1, rule.getName()]);
			const severity = rule.getSeverityLevel();

			const body = {
				severity: `${severity.valueOf()} (${SeverityLevel[severity]})`,
				engine: rule.getEngineName(),
			};
			const keys: string[] = ['severity', 'engine'];

			if (rule.getTags().length > 0) {
				body['tags'] = rule.getTags().join(', ');
				keys.push('tags');
			}

			if (rule.getResourceUrls().length == 1) {
				body['resource'] = rule.getResourceUrls()[0];
				keys.push('resource');
			} else if (rule.getResourceUrls().length > 1) {
				body['resources'] = rule.getResourceUrls();
				keys.push('resources');
			}

			if (rule.getDescription().length > 0) {
				body['description'] = rule.getDescription();
				keys.push('description');
			}

			styledRules.push(toStyledHeaderAndBody(header, body, keys));
		}
		this.display.displayLog(styledRules.join('\n\n'));
	}
}

type RuleRow = {
	num: number;
	name: string;
	engine: string;
	severity: string;
	tag: string;
};

const TABLE_COLUMNS = [
	{
		key: 'num' as keyof RuleRow,
		name: getMessage(BundleName.RuleViewer, 'summary.table.num-column')
	},
	{
		key: 'name' as keyof RuleRow,
		name: getMessage(BundleName.RuleViewer, 'summary.table.name-column')
	},
	{
		key: 'engine' as keyof RuleRow,
		name: getMessage(BundleName.RuleViewer, 'summary.table.engine-column')
	},
	{
		key: 'severity' as keyof RuleRow,
		name: getMessage(BundleName.RuleViewer, 'summary.table.severity-column')
	},
	{
		key: 'tag' as keyof RuleRow,
		name: getMessage(BundleName.RuleViewer, 'summary.table.tag-column')
	}
];

export class RuleTableDisplayer extends AbstractRuleDisplayer {
	protected _view(rules: Rule[]): void {
		const ruleJsons: RuleRow[] = rules.map((rule, idx) => {
			const severity = rule.getSeverityLevel();
			return {
				num: idx + 1,
				name: rule.getName(),
				engine: rule.getEngineName(),
				severity: `${severity.valueOf()} (${SeverityLevel[severity]})`,
				tag: rule.getTags().join(', ')
			};
		});
		this.display.displayTable({
			data: ruleJsons,
			columns: TABLE_COLUMNS,
			overflow: 'wrap' // We do not want to use truncate because it is lossy
		});
	}
}

export class RulesNoOpDisplayer implements RuleViewer {
	public view(_rules: Rule[]): void {
		return;
	}
}