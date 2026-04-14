import * as path from 'node:path';
import * as fs from 'node:fs';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import * as yaml from 'js-yaml';

export type CliOverrides = {
	noSuppressions?: boolean;
	// Future CLI flag overrides can be added here
}

export interface CodeAnalyzerConfigFactory {
	create(configPath?: string, cliOverrides?: CliOverrides): CodeAnalyzerConfig;
}

export class CodeAnalyzerConfigFactoryImpl implements CodeAnalyzerConfigFactory {
	private static readonly CONFIG_FILE_NAME: string = 'code-analyzer';
	private static readonly CONFIG_FILE_EXTENSIONS: string[] = ['yaml', 'yml'];

	public create(configPath?: string, cliOverrides?: CliOverrides): CodeAnalyzerConfig {
		// Fast path: If no CLI overrides, use existing simple logic
		if (!cliOverrides || cliOverrides.noSuppressions === undefined) {
			return this.getConfigFromProvidedPath(configPath)
			|| this.seekConfigInCurrentDirectory()
			|| CodeAnalyzerConfig.withDefaults();
		}

		// CLI overrides present - need to get file path to read raw YAML
		const usedPath = this.getConfigFilePath(configPath);

		// If config file exists, read YAML and apply CLI overrides if needed
		if (usedPath) {
			return this.createConfigFromFile(usedPath, cliOverrides);
		}

		// No config file found - create config from CLI overrides or defaults
		return this.createConfigFromCliOverrides(cliOverrides);
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

	private createConfigFromFile(
		configFilePath: string,
		cliOverrides: CliOverrides
	): CodeAnalyzerConfig {
		// Read raw YAML to check if disable_suppressions field is explicitly set
		const rawYaml: Record<string, unknown> | undefined = this.readRawYamlFile(configFilePath);
		const suppressionsSection = rawYaml?.suppressions as Record<string, unknown> | undefined;

		// Check if disable_suppressions is explicitly set in YAML
		const disableSuppressionExplicitlySet = suppressionsSection?.disable_suppressions !== undefined;

		// If YAML explicitly sets disable_suppressions, YAML wins completely (no CLI override)
		if (disableSuppressionExplicitlySet) {
			return CodeAnalyzerConfig.fromFile(configFilePath);
		}

		// At this point, disable_suppressions is NOT in YAML
		// Check if we have bulk suppressions (file paths with arrays)
		const hasBulkSuppressions = suppressionsSection && Object.keys(suppressionsSection).some(
			key => key !== 'disable_suppressions' && Array.isArray(suppressionsSection[key])
		);

		// If CLI override provided and we have bulk suppressions, merge them
		if (cliOverrides.noSuppressions !== undefined && hasBulkSuppressions && rawYaml) {
			// Preserve bulk suppressions from YAML, apply CLI override to disable_suppressions
			const mergedConfig: Record<string, unknown> = {
				...rawYaml,
				suppressions: {
					...suppressionsSection,
					disable_suppressions: cliOverrides.noSuppressions
				}
			};
			return CodeAnalyzerConfig.fromObject(mergedConfig);
		}

		// If CLI override provided but no bulk suppressions (or no suppressions section at all)
		if (cliOverrides.noSuppressions !== undefined && rawYaml) {
			const mergedConfig: Record<string, unknown> = {
				...rawYaml,
				suppressions: { disable_suppressions: cliOverrides.noSuppressions }
			};
			return CodeAnalyzerConfig.fromObject(mergedConfig);
		}

		// Config file exists, no CLI override, use config as-is with defaults
		return CodeAnalyzerConfig.fromFile(configFilePath);
	}

	private createConfigFromCliOverrides(cliOverrides: CliOverrides): CodeAnalyzerConfig {
		// Apply CLI overrides if provided
		if (cliOverrides?.noSuppressions) {
			return CodeAnalyzerConfig.fromObject({
				suppressions: { disable_suppressions: true }
			});
		}

		// No config file, no CLI overrides - use defaults (suppressions enabled)
		return CodeAnalyzerConfig.withDefaults();
	}

	private getConfigFilePath(configPath?: string): string|undefined {
		// If explicit path provided, use it
		if (configPath) {
			return configPath;
		}

		// Otherwise, seek in current directory
		for (const ext of CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_EXTENSIONS) {
			const possibleConfigFilePath = path.resolve(`${CodeAnalyzerConfigFactoryImpl.CONFIG_FILE_NAME}.${ext}`);
			if (fs.existsSync(possibleConfigFilePath)) {
				return possibleConfigFilePath;
			}
		}
		return undefined;
	}

	private readRawYamlFile(filePath: string): Record<string, unknown> | undefined {
		try {
			const fileContents = fs.readFileSync(filePath, 'utf8');
			return yaml.load(fileContents) as Record<string, unknown>;
		} catch (_err) {
			// If file can't be read or parsed, return undefined
			// The config loading will handle the error
			return undefined;
		}
	}
}
