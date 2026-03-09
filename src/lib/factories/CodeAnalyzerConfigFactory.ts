import * as path from 'node:path';
import * as fs from 'node:fs';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';

export interface CodeAnalyzerConfigFactory {
	create(configPath?: string): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl implements CodeAnalyzerConfigFactory {
	private static readonly CONFIG_FILE_NAME: string = 'code-analyzer';
	private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

	public create(configPath?: string): CodeAnalyzerConfig {
		return this.getConfigFromProvidedPath(configPath)
			|| this.seekConfigInCurrentDirectory()
			|| CodeAnalyzerConfig.withDefaults();
	}

	private getConfigFromProvidedPath(configPath?: string): CodeAnalyzerConfig|undefined {
		return configPath ? CodeAnalyzerConfig.fromFile(configPath) : undefined;
	}

	private seekConfigInCurrentDirectory(): CodeAnalyzerConfig|undefined {
		for (const ext of CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_EXTENSIONS) {
			const possibleConfigFilePath = path.resolve(`${CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_NAME}.${ext}`);
			if (fs.existsSync(possibleConfigFilePath)) {
				return CodeAnalyzerConfig.fromFile(possibleConfigFilePath);
			}
		}
		return undefined;
	}
}
