import * as path from 'node:path';

import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {CodeAnalyzerConfigFactoryImpl} from '../../../src/lib/factories/CodeAnalyzerConfigFactory.js';


describe('CodeAnalyzerConfigFactoryImpl', () => {
	it('When provided a path to a valid config file, that config is loaded', () => {
		const factory = new CodeAnalyzerConfigFactoryImpl();
		const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'sample-config-file.yml');
		const testedConfig = factory.create(configPath);
		expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
			stub1RuleB: {
				severity: 1
			},
			stub1RuleD: {
				severity: 5,
				tags: ["Recommended", "CodeStyle", "Performance"]
			}
		});
		expect(testedConfig.getRuleOverridesFor('stubEngine2')).toEqual({
			stub2RuleA: {
				tags: ['Security', 'SomeNewTag']
			}
		});
	});

	describe('When not provided a config file path, will attempt to locate a config in the current directory', () => {
		const primaryTestDir = process.cwd();

		afterEach(() => {
			// These tests will be moving into a new directory, so we should make sure to move back to the main directory
			// after each test.
			process.chdir(primaryTestDir);
		})

		it.each([
			{extension: 'yaml', dir: 'workspace-with-yaml-config', uniqueTag: 'SomeYamlOnlyTag'},
			{extension: 'yml', dir: 'workspace-with-yml-config', uniqueTag: 'SomeYmlOnlyTag'},
		])(`Locates a config with extension: .$extension}`, ({extension, dir, uniqueTag}) => {
			// ==== TEST SETUP ====
			// Move into the directory where the target config file lives.
			process.chdir(path.resolve(import.meta.dirname, '..', '..', 'fixtures', 'example-workspaces', dir));
			const factory = new CodeAnalyzerConfigFactoryImpl();

			// ==== TESTED BEHAVIOR ====
			const testedConfig = factory.create();

			// ==== ASSERTIONS ====
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleB: {
					severity: 1
				},
				stub1RuleD: {
					severity: 5,
					tags: ['Recommended', 'CodeStyle']
				}
			});
			expect(testedConfig.getRuleOverridesFor('stubEngine2')).toEqual({
				stub2RuleA: {
					tags: ['Security', uniqueTag]
				}
			});
		});

		it('A .yaml config outranks a .yml config', () => {
			// ==== TEST SETUP ====
			// Move into the directory where the target config file lives.
			process.chdir(path.join('.', 'test', 'fixtures', 'example-workspaces', 'workspace-with-multiple-configs'));
			const factory = new CodeAnalyzerConfigFactoryImpl();

			// ==== TESTED BEHAVIOR ====
			const testedConfig = factory.create();

			// ==== ASSERTIONS ====
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleB: {
					severity: 1
				},
				stub1RuleD: {
					severity: 5,
					tags: ['Recommended', 'CodeStyle']
				}
			});
			expect(testedConfig.getRuleOverridesFor('stubEngine2')).toEqual({
				stub2RuleA: {
					tags: ['Security', 'SomeYamlOnlyTag']
				}
			});
		});
	});

	it('When no path is provided and no config can be located, the default config is used', () => {
		const factory = new CodeAnalyzerConfigFactoryImpl();
		const expectedConfig = CodeAnalyzerConfig.withDefaults();

		const testedConfig = factory.create();

		expect(testedConfig).toEqual(expectedConfig);
	});

	it('When provided a path to an invalid config file, throws helpful error', () => {
		const factory = new CodeAnalyzerConfigFactoryImpl();
		// Specify a config file that specifies a non-existent log_folder property.
		const configPath = path.resolve('test', 'fixtures', 'invalid-configs', 'nonexistent-log-folder.yml');
		// Attempt to load the config, and assert that the error message mentions the bad log folder.
		// From that, we can reasonably surmise that the log folder was the cause of the error, and be satisfied
		// that the user was informed of this problem.
		expect(() => factory.create(configPath)).toThrow('nonExistentLogFolder');
	});

	describe('CLI Overrides functionality', () => {
		it('When no config file and no CLI overrides, uses defaults (suppressions enabled)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const testedConfig = factory.create(undefined, undefined);

			// Suppressions should be enabled by default
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
		});

		it('When no config file and noSuppressions override is true, disables suppressions', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const testedConfig = factory.create(undefined, { noSuppressions: true });

			// Suppressions should be disabled due to CLI override
			expect(testedConfig.getSuppressionsEnabled()).toBe(false);
		});

		it('When no config file and noSuppressions override is false, uses defaults (suppressions enabled)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const testedConfig = factory.create(undefined, { noSuppressions: false });

			// Suppressions should be enabled (default behavior)
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
		});

		it('When config file (no suppressions field) exists with explicit path, CLI override is applied', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'sample-config-file.yml');

			// Config file doesn't have suppressions field, CLI override tries to disable
			const testedConfig = factory.create(configPath, { noSuppressions: true });

			// CLI override should be applied since YAML doesn't specify suppressions
			expect(testedConfig.getSuppressionsEnabled()).toBe(false);
			// Verify rule overrides from config are still loaded
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleB: {
					severity: 1
				},
				stub1RuleD: {
					severity: 5,
					tags: ["Recommended", "CodeStyle", "Performance"]
				}
			});
		});

		it('When config file (no suppressions field) is auto-discovered, CLI override is applied', () => {
			const primaryTestDir = process.cwd();
			try {
				// Move into directory with config file
				process.chdir(path.resolve(import.meta.dirname, '..', '..', 'fixtures', 'example-workspaces', 'workspace-with-yaml-config'));
				const factory = new CodeAnalyzerConfigFactoryImpl();

				// Config file doesn't have suppressions field, CLI override tries to disable
				const testedConfig = factory.create(undefined, { noSuppressions: true });

				// CLI override should be applied since YAML doesn't specify suppressions
				expect(testedConfig.getSuppressionsEnabled()).toBe(false);
				// Verify rule overrides from config are still loaded
				expect(testedConfig.getRuleOverridesFor('stubEngine2')).toEqual({
					stub2RuleA: {
						tags: ['Security', 'SomeYamlOnlyTag']
					}
				});
			} finally {
				process.chdir(primaryTestDir);
			}
		});

		it('When YAML config enables suppressions, CLI override to disable is ignored (YAML wins)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-with-suppressions-enabled.yml');

			// Config file has suppressions enabled (disable_suppressions: false)
			// CLI override tries to disable suppressions (noSuppressions: true)
			const testedConfig = factory.create(configPath, { noSuppressions: true });

			// YAML config should win - suppressions should be ENABLED
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
		});

		it('When YAML config enables suppressions, CLI override to keep enabled is ignored (YAML wins, both agree)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-with-suppressions-enabled.yml');

			// Config file has suppressions enabled (disable_suppressions: false)
			// CLI override also tries to keep enabled (noSuppressions: false)
			const testedConfig = factory.create(configPath, { noSuppressions: false });

			// YAML config should win - suppressions should be ENABLED (both agree)
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
		});

		it('When YAML config disables suppressions, CLI override is ignored (YAML wins)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-with-suppressions-disabled.yml');

			// Config file has suppressions disabled (disable_suppressions: true)
			// CLI override is not provided (should not matter)
			const testedConfig = factory.create(configPath, { noSuppressions: false });

			// YAML config should win - suppressions should be DISABLED
			expect(testedConfig.getSuppressionsEnabled()).toBe(false);
		});

		it('When YAML config disables suppressions and CLI also tries to disable, YAML wins (both disabled)', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-with-suppressions-disabled.yml');

			// Both config file and CLI override want to disable suppressions
			const testedConfig = factory.create(configPath, { noSuppressions: true });

			// YAML config wins (but result is same - disabled)
			expect(testedConfig.getSuppressionsEnabled()).toBe(false);
		});

		it('When YAML config exists but does not specify suppressions field, CLI override is applied', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-without-suppressions-field.yml');

			// Config file exists but doesn't have suppressions field
			// CLI override tries to disable suppressions
			const testedConfig = factory.create(configPath, { noSuppressions: true });

			// CLI override should be applied since YAML doesn't specify suppressions
			expect(testedConfig.getSuppressionsEnabled()).toBe(false);
			// Verify rule overrides from config are still loaded
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleC: {
					severity: 4,
					tags: ['TestTag']
				}
			});
		});

		it('When YAML config exists without suppressions field and CLI override says keep enabled, uses default', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-without-suppressions-field.yml');

			// Config file exists but doesn't have suppressions field
			// CLI override tries to keep suppressions enabled (noSuppressions: false)
			const testedConfig = factory.create(configPath, { noSuppressions: false });

			// CLI override should be applied - suppressions enabled
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
			// Verify rule overrides from config are still loaded
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleC: {
					severity: 4,
					tags: ['TestTag']
				}
			});
		});

		it('When YAML config exists without suppressions field and no CLI override, uses defaults', () => {
			const factory = new CodeAnalyzerConfigFactoryImpl();
			const configPath = path.resolve('test', 'fixtures', 'valid-configs', 'config-without-suppressions-field.yml');

			// Config file exists but doesn't have suppressions field
			// No CLI override provided
			const testedConfig = factory.create(configPath, undefined);

			// Should use default (suppressions enabled)
			expect(testedConfig.getSuppressionsEnabled()).toBe(true);
			// Verify rule overrides from config are still loaded
			expect(testedConfig.getRuleOverridesFor('stubEngine1')).toEqual({
				stub1RuleC: {
					severity: 4,
					tags: ['TestTag']
				}
			});
		});
	});
});
