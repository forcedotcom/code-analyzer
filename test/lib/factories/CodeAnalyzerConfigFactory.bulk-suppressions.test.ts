import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

import {CodeAnalyzerConfigFactoryImpl} from '../../../src/lib/factories/CodeAnalyzerConfigFactory.js';

/**
 * Tests specifically for Bug #1: Factory not recognizing bulk suppressions
 *
 * BUG: CodeAnalyzerConfigFactory.ts checked if `disable_suppressions !== undefined`
 * instead of checking if `suppressions !== undefined`. This caused YAML configs
 * with ONLY bulk suppressions (no disable_suppressions field) to be ignored.
 */
describe('CodeAnalyzerConfigFactory - Bulk Suppressions Bug Tests', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-factory-test-'));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it('When YAML has bulk suppressions without disable_suppressions field, bulk suppressions are loaded', () => {
		// This is the exact scenario that exposed Bug #1
		const configContent = `
ignores:
  files:
    - test_file.xml

suppressions:
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
    - rule_selector: pmd:UnusedMethod
      max_suppressed_violations: 2
      reason: Helper methods for debugging
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath);

		// Verify bulk suppressions were loaded (Bug #1 would fail here - returns empty object)
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');
		expect(bulkSuppressions['src/utils.js']).toHaveLength(2);
		expect(bulkSuppressions['src/utils.js'][0]).toEqual({
			rule_selector: 'eslint:all',
			max_suppressed_violations: 3,
			reason: undefined
		});
		expect(bulkSuppressions['src/utils.js'][1]).toEqual({
			rule_selector: 'pmd:UnusedMethod',
			max_suppressed_violations: 2,
			reason: 'Helper methods for debugging'
		});

		// Suppressions should be enabled by default
		expect(testedConfig.getSuppressionsEnabled()).toBe(true);
	});

	it('When YAML has only disable_suppressions (no bulk suppressions), it still works', () => {
		// This case worked before Bug #1 fix - keeping for regression
		const configContent = `
suppressions:
  disable_suppressions: true
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath);

		// Verify suppressions are disabled
		expect(testedConfig.getSuppressionsEnabled()).toBe(false);

		// Bulk suppressions should be empty
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(Object.keys(bulkSuppressions)).toHaveLength(0);
	});

	it('When YAML has both disable_suppressions and bulk suppressions, both are loaded', () => {
		const configContent = `
suppressions:
  disable_suppressions: false
  "src/file.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 5
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath);

		// Verify both are loaded correctly
		expect(testedConfig.getSuppressionsEnabled()).toBe(true);
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/file.js');
		expect(bulkSuppressions['src/file.js'][0]).toEqual({
			rule_selector: 'eslint:all',
			max_suppressed_violations: 5,
			reason: undefined
		});
	});

	it('When YAML has bulk suppressions (no disable_suppressions field) and CLI override, bulk suppressions preserved AND CLI override applies', () => {
		// This is the CORRECT behavior:
		// - Bulk suppressions from YAML are preserved
		// - CLI override applies to disable_suppressions (since not in YAML)
		const configContent = `
suppressions:
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: true });

		// YAML bulk suppressions should be preserved
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');
		expect(bulkSuppressions['src/utils.js']).toHaveLength(1);

		// CLI override should apply since disable_suppressions was NOT in YAML
		expect(testedConfig.getSuppressionsEnabled()).toBe(false);
	});

	it('When YAML has BOTH bulk suppressions AND disable_suppressions, YAML wins completely (CLI override ignored)', () => {
		// If YAML explicitly sets disable_suppressions, YAML wins everything
		const configContent = `
suppressions:
  disable_suppressions: false
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: true });

		// YAML bulk suppressions preserved
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');
		expect(bulkSuppressions['src/utils.js']).toHaveLength(1);

		// YAML wins for disable_suppressions (CLI override ignored)
		expect(testedConfig.getSuppressionsEnabled()).toBe(true);
	});

	it('BUG #1: When YAML has NO suppressions section at all, CLI override works', () => {
		// This case worked before - keeping for regression
		const configContent = `
rules:
  eslint:
    no-console:
      severity: 2
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: true });

		// CLI override should work
		expect(testedConfig.getSuppressionsEnabled()).toBe(false);

		// Bulk suppressions should be empty
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(Object.keys(bulkSuppressions)).toHaveLength(0);
	});

	it('When YAML has bulk suppressions (no disable_suppressions) and NO CLI override, uses defaults for disable_suppressions', () => {
		// Bulk suppressions present, disable_suppressions not in YAML, no CLI override
		const configContent = `
suppressions:
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, undefined);

		// Bulk suppressions preserved
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');

		// Default behavior: suppressions enabled
		expect(testedConfig.getSuppressionsEnabled()).toBe(true);
	});

	it('When YAML has bulk suppressions (no disable_suppressions) and CLI override false, bulk suppressions preserved and enabled', () => {
		// Bulk suppressions present, CLI override says keep enabled
		const configContent = `
suppressions:
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: false });

		// Bulk suppressions preserved
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');

		// CLI override applies: enabled
		expect(testedConfig.getSuppressionsEnabled()).toBe(true);
	});

	it('When YAML has empty suppressions object (only disable_suppressions: true), CLI override ignored', () => {
		// disable_suppressions explicitly set, no bulk suppressions
		const configContent = `
suppressions:
  disable_suppressions: true
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: false });

		// No bulk suppressions
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(Object.keys(bulkSuppressions)).toHaveLength(0);

		// YAML wins: disabled (CLI override ignored)
		expect(testedConfig.getSuppressionsEnabled()).toBe(false);
	});

	it('BEHAVIOR: When --no-suppressions flag used, bulk suppression CONFIG is preserved but suppressions are DISABLED', () => {
		// This verifies the correct behavior:
		// - Bulk suppression config (file paths and rules) is preserved in config object
		// - But disable_suppressions is set to true, so suppressions are not applied
		const configContent = `
suppressions:
  "src/utils.js":
    - rule_selector: eslint:all
      max_suppressed_violations: 3
    - rule_selector: pmd:UnusedMethod
      max_suppressed_violations: 2
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath, { noSuppressions: true });

		// Bulk suppression CONFIG is preserved in the config object
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(bulkSuppressions).toHaveProperty('src/utils.js');
		expect(bulkSuppressions['src/utils.js']).toHaveLength(2);
		expect(bulkSuppressions['src/utils.js'][0].rule_selector).toBe('eslint:all');

		// But suppressions are disabled (so they won't be applied during analysis)
		expect(testedConfig.getSuppressionsEnabled()).toBe(false);
	});

	it('BUG #1: Multiple file paths with multiple rules each are all loaded', () => {
		const configContent = `
suppressions:
  "src/file1.js":
    - rule_selector: eslint:no-console
      max_suppressed_violations: 2
    - rule_selector: eslint:no-unused-vars
      max_suppressed_violations: 3
  "src/file2.js":
    - rule_selector: pmd:UnusedMethod
      max_suppressed_violations: 1
  "src/folder/":
    - rule_selector: all
      max_suppressed_violations: 10
`;
		const configPath = path.join(tempDir, 'code-analyzer.yml');
		fs.writeFileSync(configPath, configContent, 'utf8');

		const factory = new CodeAnalyzerConfigFactoryImpl();
		const testedConfig = factory.create(configPath);

		// Verify all paths and rules are loaded
		const bulkSuppressions = testedConfig.getBulkSuppressions();
		expect(Object.keys(bulkSuppressions)).toHaveLength(3);
		expect(bulkSuppressions['src/file1.js']).toHaveLength(2);
		expect(bulkSuppressions['src/file2.js']).toHaveLength(1);
		expect(bulkSuppressions['src/folder/']).toHaveLength(1);

		// Check specific rules
		expect(bulkSuppressions['src/file1.js'][0].rule_selector).toBe('eslint:no-console');
		expect(bulkSuppressions['src/file2.js'][0].rule_selector).toBe('pmd:UnusedMethod');
		expect(bulkSuppressions['src/folder/'][0].max_suppressed_violations).toBe(10);
	});
});
