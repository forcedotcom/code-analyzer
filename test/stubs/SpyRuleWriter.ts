import { RuleSelection } from '@salesforce/code-analyzer-core';
import { RulesWriter } from '../../src/lib/writers/RulesWriter.js';

export class SpyRuleWriter implements RulesWriter {
    private callHistory: RuleSelection[] = [];
    
    public write(rules: RuleSelection): void {
        this.callHistory.push(rules);
    }
    
    public getCallHistory(): RuleSelection[] {
        return this.callHistory;
    }
}
