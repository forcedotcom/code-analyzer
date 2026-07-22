import {EnginePlugin} from '@salesforce/code-analyzer-engine-api';
import * as ESLintEngineModule from '@salesforce/code-analyzer-eslint-engine';
import * as PmdCpdEnginesModule from '@salesforce/code-analyzer-pmd-engine';
import * as RetireJSEngineModule from '@salesforce/code-analyzer-retirejs-engine';
import * as RegexEngineModule from '@salesforce/code-analyzer-regex-engine';
import * as FlowEngineModule from '@salesforce/code-analyzer-flow-engine';
import * as SfgeEngineModule from '@salesforce/code-analyzer-sfge-engine';

export interface EnginePluginsFactory {
	create(): EnginePlugin[];
}

export class EnginePluginsFactoryImpl implements EnginePluginsFactory {
	public create(): EnginePlugin[] {
		return [
			ESLintEngineModule.createEnginePlugin(),
			PmdCpdEnginesModule.createEnginePlugin(),
			RetireJSEngineModule.createEnginePlugin(),
			RegexEngineModule.createEnginePlugin(),
			FlowEngineModule.createEnginePlugin(),
			SfgeEngineModule.createEnginePlugin()
		];
	}
}
