import {Rule} from '@salesforce/code-analyzer-core';
import {RuleViewer} from '../../src/lib/viewers/RuleViewer.js';


export class SpyRuleViewer implements RuleViewer {
	private callHistory: Rule[][] = [];

	public view(rules: Rule[]): void {
		this.callHistory.push(rules);
	}

	public getCallHistory(): Rule[][] {
		return this.callHistory;
	}
}
