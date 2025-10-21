import {RunResults} from '@salesforce/code-analyzer-core';
import {ResultsViewer} from '../../src/lib/viewers/ResultsViewer.js';

export class SpyResultsViewer implements ResultsViewer {
	private callHistory: RunResults[] = [];

	public view(results: RunResults): void {
		this.callHistory.push(results);
	}

	public getCallHistory(): RunResults[] {
		return this.callHistory;
	}
}
