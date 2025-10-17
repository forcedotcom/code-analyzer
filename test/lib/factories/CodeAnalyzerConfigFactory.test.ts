import * as path from 'node:path';

import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {CodeAnalyzerConfigFactoryImpl} from '../../../src/lib/factories/CodeAnalyzerConfigFactory';


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
			process.chdir(path.resolve(__dirname, '..', '..', 'fixtures', 'example-workspaces', dir));
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
});
