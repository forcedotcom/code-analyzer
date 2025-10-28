import {ConfigModel, OutputFormat} from '../../src/lib/models/ConfigModel.js';

export class StubConfigModel implements ConfigModel {
	public toFormattedOutput(format: OutputFormat): string {
		return `# This is a leading comment\n`
			+ `Results formatted as ${format}`
	}
}
