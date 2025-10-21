import {ConfigModel} from '../../src/lib/models/ConfigModel.js';
import {ConfigWriter} from '../../src/lib/writers/ConfigWriter.js';

export class SpyConfigWriter implements ConfigWriter {
	private simulateSuccessfulWrites: boolean;
	private callHistory: ConfigModel[] = [];

	public constructor(simulateSuccessfulWrites: boolean = true) {
		this.simulateSuccessfulWrites = simulateSuccessfulWrites;
	}

	public write(config: ConfigModel): Promise<boolean> {
		this.callHistory.push(config);
		return Promise.resolve(this.simulateSuccessfulWrites);
	}

	public getCallHistory(): ConfigModel[] {
		return this.callHistory;
	}
}
