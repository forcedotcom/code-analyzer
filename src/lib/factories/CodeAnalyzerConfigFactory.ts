import * as path from 'node:path';
import * as fs from 'node:fs';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import * as yaml from 'js-yaml';

export type CliOverrides = {
	noSuppressions?: boolean;
	targetOrg?: string;
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
		if (!cliOverrides || (cliOverrides.noSuppressions === undefined && cliOverrides.targetOrg === undefined)) {
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
		if (disableSuppressionExplicitlySet && !cliOverrides.targetOrg) {
			return CodeAnalyzerConfig.fromFile(configFilePath);
		}

		// At this point, disable_suppressions is NOT in YAML
		// Check if we have bulk suppressions (file paths with arrays)
		const hasBulkSuppressions = suppressionsSection && Object.keys(suppressionsSection).some(
			key => key !== 'disable_suppressions' && Array.isArray(suppressionsSection[key])
		);

		// Build merged config with any CLI overrides
		let mergedConfig: Record<string, unknown> = rawYaml ? { ...rawYaml } : {};

		// Apply suppressions override if needed
		if (cliOverrides.noSuppressions !== undefined && hasBulkSuppressions) {
			mergedConfig = {
				...mergedConfig,
				suppressions: {
					...suppressionsSection,
					disable_suppressions: cliOverrides.noSuppressions
				}
			};
		} else if (cliOverrides.noSuppressions !== undefined) {
			mergedConfig = {
				...mergedConfig,
				suppressions: { disable_suppressions: cliOverrides.noSuppressions }
			};
		}

		// Apply target-org override to apexguru engine config
		if (cliOverrides.targetOrg) {
			const enginesSection = mergedConfig.engines as Record<string, Record<string, unknown>> | undefined;
			mergedConfig = {
				...mergedConfig,
				engines: {
					...(enginesSection || {}),
					apexguru: {
						...(enginesSection?.apexguru || {}),
						target_org: cliOverrides.targetOrg
					}
				}
			};
		}

		return rawYaml ? CodeAnalyzerConfig.fromObject(mergedConfig) : CodeAnalyzerConfig.fromFile(configFilePath);
	}

	private createConfigFromCliOverrides(cliOverrides: CliOverrides): CodeAnalyzerConfig {
		// Build config from CLI overrides
		const configObject: Record<string, unknown> = {};

		if (cliOverrides?.noSuppressions) {
			configObject.suppressions = { disable_suppressions: true };
		}

		if (cliOverrides?.targetOrg) {
			configObject.engines = {
				apexguru: {
					target_org: cliOverrides.targetOrg
				}
			};
		}

		// If we have overrides, create config from them; otherwise use defaults
		return Object.keys(configObject).length > 0
			? CodeAnalyzerConfig.fromObject(configObject)
			: CodeAnalyzerConfig.withDefaults();
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
