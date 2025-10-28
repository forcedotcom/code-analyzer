import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {CodeAnalyzerConfigFactory} from '../../src/lib/factories/CodeAnalyzerConfigFactory.js';

export class StubDefaultConfigFactory implements CodeAnalyzerConfigFactory {
	public create(_configPath?: string): CodeAnalyzerConfig {
		// Just return the default config. It's fine.
		return CodeAnalyzerConfig.withDefaults();
	}
}
