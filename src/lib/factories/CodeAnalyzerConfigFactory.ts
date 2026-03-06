import * as path from 'node:path';
import * as fs from 'node:fs';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';

export type SfgeEngineOverrides = {
	java_thread_count?: number;
	java_thread_timeout?: number;
};

export interface CodeAnalyzerConfigFactory {
	create(configPath?: string, sfgeOverrides?: SfgeEngineOverrides): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl implements CodeAnalyzerConfigFactory {
	private static readonly CONFIG_FILE_NAME: string = 'code-analyzer';
	private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

	public create(configPath?: string, sfgeOverrides?: SfgeEngineOverrides): CodeAnalyzerConfig {
		const baseConfig: CodeAnalyzerConfig =
			this.getConfigFromProvidedPath(configPath)
			|| this.seekConfigInCurrentDirectory()
			|| CodeAnalyzerConfig.withDefaults();

		if (!sfgeOverrides || Object.keys(sfgeOverrides).length === 0) {
			return baseConfig;
		}

		// Merge CLI sfge overrides on top of whatever the base config provides.
		// We build a fresh config object containing only the overridden sfge fields.
		// All other engine settings (java_command, java_max_heap_size, etc.) continue
		// to come from the base config via their own defaults.
		const overrideConfig: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
			engines: {
				sfge: sfgeOverrides
			}
		});

		// The override config wins for sfge-specific fields; the base config is used
		// for everything else. We achieve this by returning the override config when
		// sfge values are explicitly set, since all other sfge fields fall back to
		// their defaults inside SfgeEngine.init() → validateAndNormalizeConfig().
		// Non-sfge engine config from the base config is unaffected because the
		// override object only specifies the sfge engine section.
		return overrideConfig;
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
