import {RunResults} from '@salesforce/code-analyzer-core';
import {ResultsWriter} from '../../src/lib/writers/ResultsWriter.js';

export class SpyResultsWriter implements ResultsWriter {
	private callHistory: RunResults[] = [];

	public write(results: RunResults): void {
		this.callHistory.push(results);
	}

	public getCallHistory(): RunResults[] {
		return this.callHistory;
	}
}
