import {expect, test} from '@salesforce/command/lib/test';
import {Messages} from '@salesforce/core';
import {SFDX_SCANNER_PATH} from '../../../src/Constants';
import {Controller} from '../../../src/ioc.config';
import fs = require('fs');
import path = require('path');
import process = require('process');
import tildify = require('tildify');
import events = require('../../../messages/EventKeyTemplates');

const CATALOG_OVERRIDE = 'RunTestCatalog.json';
const CUSTOM_PATHS_OVERRIDE = 'RunTestCustomPaths.json';

Messages.importMessagesDirectory(__dirname);
const runMessages = Messages.loadMessages('@salesforce/sfdx-scanner', 'run');
const eventMessages = Messages.loadMessages('@salesforce/sfdx-scanner', 'EventKeyTemplates');

// Before our tests, delete any existing catalog and/or custom path associated with our override.
if (fs.existsSync(path.join(SFDX_SCANNER_PATH, CATALOG_OVERRIDE))) {
	fs.unlinkSync(path.join(SFDX_SCANNER_PATH, CATALOG_OVERRIDE));
}
if (fs.existsSync(path.join(SFDX_SCANNER_PATH, CUSTOM_PATHS_OVERRIDE))) {
	fs.unlinkSync(path.join(SFDX_SCANNER_PATH, CUSTOM_PATHS_OVERRIDE));
}

const runTest = test.env({CATALOG_FILE: CATALOG_OVERRIDE, CUSTOM_PATHS_FILE: CUSTOM_PATHS_OVERRIDE});

describe('scanner:run', function () {
	// Reset our controller since we are using alternate file locations
	before(() => Controller.reset());

	this.timeout(10000); // TODO why do we get timeouts at the default of 5000?  What is so expensive here?

	describe('E2E', () => {
		describe('Output Type: XML', () => {
			describe('Test Case: Running rules against a single file', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('When the file contains violations, they are logged out as an XML', ctx => {
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be four violations.
						expect(violations.length).to.equal(4, 'Should be four violations detected in the file');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(violations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});

				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('When the file contains no violations, a message is logged to the console', ctx => {
						expect(ctx.stdout).to.contain(runMessages.getMessage('output.noViolationsDetected'));
					});
			});

			describe('Test Case: Running rules against multiple specified files', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls') + ',' + path.join('test', 'code-fixtures', 'apex', 'InstallProcessorTests.cls'),
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('Both files are evaluated, and any violations are logged', ctx => {
						// We'll split the output by the <file> tag first, so we can get each file that violated rules.
						const results = ctx.stdout.split('<result ');
						results.shift();
						// Verify that each set of violations corresponds to the expected file.
						expect(results.length).to.equal(2, 'Only two files should have violated the rules');
						expect(results[0]).to.match(/file="test\/code-fixtures\/apex\/AccountServiceTests.cls"/);
						expect(results[1]).to.match(/file="test\/code-fixtures\/apex\/InstallProcessorTests.cls"/);

						// Now, split each file's violations by the <violation> tag so we can inspect individual violations.
						const acctServiceViolations = results[0].split('<violation');
						acctServiceViolations.shift();
						// There should be four violations.
						expect(acctServiceViolations.length).to.equal(4, 'Should be four violations detected in AccountServiceTests.cls');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(acctServiceViolations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);

						const installProcessorViolations = results[1].split('<violation');
						installProcessorViolations.shift();
						// There should be one violation.
						expect(installProcessorViolations.length).to.equal(1, 'Should be one violation detected in InstallProcessorTests.cls');
						expect(installProcessorViolations[0]).to.match(/line="994".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});
			});

			describe('Test Case: Running rules against a folder', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex'),
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('Any violations in the folder are logged as an XML', ctx => {
						// We'll split the output by the <file> tag first, so we can get each file that violated rules.
						const results = ctx.stdout.split('<result ');
						// The first list item is going to be the header, so we need to pull that off.
						results.shift();
						// Verify that each set of violations corresponds to the expected file.
						expect(results.length).to.equal(2, 'Only two files should have violated the rules');
						expect(results[0]).to.match(/file="test\/code-fixtures\/apex\/AccountServiceTests.cls"/);
						expect(results[1]).to.match(/file="test\/code-fixtures\/apex\/InstallProcessorTests.cls"/);

						// Now, split each file's violations by the <violation> tag so we can inspect individual violations.
						const acctServiceViolations = results[0].split('<violation');
						acctServiceViolations.shift();
						// There should be four violations.
						expect(acctServiceViolations.length).to.equal(4, 'Should be four violations detected in AccountServiceTests.cls');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(acctServiceViolations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);

						const installProcessorViolations = results[1].split('<violation');
						installProcessorViolations.shift();
						// There should be one violation.
						expect(installProcessorViolations.length).to.equal(1, 'Should be one violation detected in InstallProcessorTests.cls');
						expect(installProcessorViolations[0]).to.match(/line="994".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});
			});

			describe('Test Case: Running multiple rulesets at once', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
						'--ruleset', 'ApexUnit,Style',
						'--format', 'xml'
					])
					.it('Violations from each rule are logged as an XML', ctx => {
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be eleven violations.
						expect(violations.length).to.equal(11, 'Should be eleven violations detected in the file');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(violations[0]).to.match(/line="12".+rule="VariableNamingConventions"/);
						expect(violations[1]).to.match(/line="13".+rule="VariableNamingConventions"/);
						expect(violations[2]).to.match(/line="64".+rule="MethodNamingConventions"/);
						expect(violations[3]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[4]).to.match(/line="68".+rule="MethodNamingConventions"/);
						expect(violations[5]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[6]).to.match(/line="72".+rule="MethodNamingConventions"/);
						expect(violations[7]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[8]).to.match(/line="76".+rule="MethodNamingConventions"/);
						expect(violations[9]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[10]).to.match(/line="80".+rule="MethodNamingConventions"/);
					});
			});

			describe('Test Case: Writing XML results to a file', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
						'--ruleset', 'ApexUnit',
						'--outfile', 'testout.xml'
					])
					.finally(ctx => {
						// Regardless of what happens in the test itself, we need to delete the file we created.
						if (fs.existsSync('testout.xml')) {
							fs.unlinkSync('testout.xml');
						}
					})
					.it('The violations are written to the file as an XML', ctx => {
						// Verify that the file we wanted was actually created.
						expect(fs.existsSync('testout.xml')).to.equal(true, 'The command should have created the expected output file');
						const fileContents = fs.readFileSync('testout.xml').toString();
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = fileContents.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be four violations.
						expect(violations.length).to.equal(4, 'Should be four violations detected in the file');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(violations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});
			});
		});

		describe('Output Type: CSV', () => {
			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
					'--ruleset', 'ApexUnit',
					'--format', 'csv'
				])
				.it('Properly writes CSV to console', ctx => {
					// Split the output by newline characters and throw away the first entry, so we're left with just the rows.
					const rows = ctx.stdout.trim().split('\n');
					rows.shift();

					// There should be four rows.
					expect(rows.length).to.equal(4, 'Should be four violations detected');

					// Split each row by commas, so we'll have each cell.
					const data = rows.map(val => val.split(','));
					// Verify that each row looks approximately right.
					expect(data[0][3]).to.equal('"68"', 'Violation #1 should occur on the expected line');
					expect(data[1][3]).to.equal('"72"', 'Violation #2 should occur on the expected line');
					expect(data[2][3]).to.equal('"76"', 'Violation #3 should occur on the expected line');
					expect(data[3][3]).to.equal('"80"', 'Violation #4 should occur on the expected line');
					expect(data[0][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #1 should be of the expected type');
					expect(data[1][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #2 should be of the expected type');
					expect(data[2][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #3 should be of the expected type');
					expect(data[3][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #4 should be of the expected type');
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
					'--ruleset', 'ApexUnit',
					'--outfile', 'testout.csv'
				])
				.finally(ctx => {
					// Regardless of what happens in the test itself, we need to delete the file we created.
					if (fs.existsSync('testout.csv')) {
						fs.unlinkSync('testout.csv');
					}
				})
				.it('Properly writes CSV to file', ctx => {
					// Verify that the correct message is displayed to user
					expect(ctx.stdout).to.contain(runMessages.getMessage('output.writtenToOutFile', ['testout.csv']));
					expect(ctx.stdout).to.not.contain(runMessages.getMessage('output.noViolationsDetected', []));

					// Verify that the file we wanted was actually created.
					expect(fs.existsSync('testout.csv')).to.equal(true, 'The command should have created the expected output file');
					const fileContents = fs.readFileSync('testout.csv').toString();
					// Split the output by newline characters and throw away the first entry, so we're left with just the rows.
					const rows = fileContents.trim().split('\n');
					rows.shift();

					// There should be four rows.
					expect(rows.length).to.equal(4, 'Should be four violations detected');

					// Split each row by commas, so we'll have each cell.
					const data = rows.map(val => val.split(','));
					// Verify that each row looks approximately right.
					expect(data[0][3]).to.equal('"68"', 'Violation #1 should occur on the expected line');
					expect(data[1][3]).to.equal('"72"', 'Violation #2 should occur on the expected line');
					expect(data[2][3]).to.equal('"76"', 'Violation #3 should occur on the expected line');
					expect(data[3][3]).to.equal('"80"', 'Violation #4 should occur on the expected line');
					expect(data[0][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #1 should be of the expected type');
					expect(data[1][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #2 should be of the expected type');
					expect(data[2][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #3 should be of the expected type');
					expect(data[3][6]).to.equal('"ApexUnitTestClassShouldHaveAsserts"', 'Violation #4 should be of the expected type');
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
					'--ruleset', 'ApexUnit',
					'--format', 'csv'
				])
				.it('When no violations are detected, a message is logged to the console', ctx => {
					expect(ctx.stdout).to.contain(runMessages.getMessage('output.noViolationsDetected'));
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
					'--ruleset', 'ApexUnit',
					'--outfile', 'testout.csv'
				])
				.finally(ctx => {
					// Regardless of what happens in the test itself, we need to delete the file we created.
					if (fs.existsSync('testout.csv')) {
						fs.unlinkSync('testout.csv');
					}
				})
				.it('When --oufile is provided and no violations are detected, output file should not be created', ctx => {
					expect(ctx.stdout).to.contain(runMessages.getMessage('output.noViolationsDetected', []));
					expect(ctx.stdout).to.not.contain(runMessages.getMessage('output.writtenToOutFile', ['testout.csv']));
					expect(fs.existsSync('testout.csv')).to.be.false;
				});
		});

		describe('Output Type: Table', () => {
			// The table can't be written to a file, so we're just testing the console.
			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
					'--ruleset', 'ApexUnit',
					'--format', 'table'
				])
				.it('Properly writes table to the console', ctx => {
					// Split the output by newline characters and throw away the first two rows, which are the column names and a separator.
					// That will leave us with just the rows.
					const rows = ctx.stdout.trim().split('\n');

					// Assert rows have the right error on the right line.
					expect(rows.find(r => r.indexOf("AccountServiceTests.cls:68") > 0)).to.contain('Apex unit tests should System.assert()');
					expect(rows.find(r => r.indexOf("AccountServiceTests.cls:72") > 0)).to.contain('Apex unit tests should System.assert()');
					expect(rows.find(r => r.indexOf("AccountServiceTests.cls:76") > 0)).to.contain('Apex unit tests should System.assert()');
					expect(rows.find(r => r.indexOf("AccountServiceTests.cls:80") > 0)).to.contain('Apex unit tests should System.assert()');
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run',
					'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
					'--ruleset', 'ApexUnit',
					'--format', 'table'
				])
				.it('When no violations are detected, a message is logged to the console', ctx => {
					expect(ctx.stdout).to.contain(runMessages.getMessage('output.noViolationsDetected'));
				});
		});

		describe('Dynamic Input', () => {
			describe('Test Case: Running rules against a glob', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						// NOTE: When running the command for real, a glob would have to be wrapped in SINGLE-QUOTES. But the tests sidestep that, somehow.
						'--target', 'test/code-fixtures/apex/*Tests.cls',
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('Glob is resolved to files, and those files are evaluated', ctx => {
						// We'll split the output by the <file> tag first, so we can get each file that violated rules.
						const results = ctx.stdout.split('<result ');
						// The first list item is going to be the header, so we need to pull that off.
						results.shift();
						// Verify that each set of violations corresponds to the expected file.
						expect(results.length).to.equal(2, 'Only two files should have violated the rules');
						expect(results[0]).to.match(/file="test\/code-fixtures\/apex\/AccountServiceTests.cls"/);
						expect(results[1]).to.match(/file="test\/code-fixtures\/apex\/InstallProcessorTests.cls"/);

						// Now, split each file's violations by the <violation> tag so we can inspect individual violations.
						const acctServiceViolations = results[0].split('<violation');
						acctServiceViolations.shift();
						// There should be four violations.
						expect(acctServiceViolations.length).to.equal(4, 'Should be four violations detected in AccountServiceTests.cls');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(acctServiceViolations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(acctServiceViolations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);

						const installProcessorViolations = results[1].split('<violation');
						installProcessorViolations.shift();
						// There should be one violation.
						expect(installProcessorViolations.length).to.equal(1, 'Should be one violation detected in InstallProcessorTests.cls');
						expect(installProcessorViolations[0]).to.match(/line="994".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});
			});

			describe('Test Case: Using ~/ shorthand in target', () => {
				const pathWithTilde = tildify(path.join(process.cwd(), 'test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'));
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', pathWithTilde,
						'--ruleset', 'ApexUnit',
						'--format', 'xml'
					])
					.it('Tilde is expanded to full directory', ctx => {
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be four violations.
						expect(violations.length).to.equal(4, 'Should be four violations detected in the file');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(violations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);
					});
			});
		});

		describe('Edge Cases', () => {
			describe('Test case: No output specified', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls'),
						'--ruleset', 'ApexUnit'
					])
					.it('When no format is specified, we default to a TABLE', ctx => {
						// Split the output by newline characters and throw away the first two rows, which are the column names and a separator.
						// That will leave us with just the rows.
						const rows = ctx.stdout.trim().split('\n');
						rows.shift();
						rows.shift();

						// Assert rows have the right error on the right line.
						expect(rows.find(r => r.indexOf("AccountServiceTests.cls:68") > 0)).to.contain('Apex unit tests should System.assert()');
						expect(rows.find(r => r.indexOf("AccountServiceTests.cls:72") > 0)).to.contain('Apex unit tests should System.assert()');
						expect(rows.find(r => r.indexOf("AccountServiceTests.cls:76") > 0)).to.contain('Apex unit tests should System.assert()');
						expect(rows.find(r => r.indexOf("AccountServiceTests.cls:80") > 0)).to.contain('Apex unit tests should System.assert()');
					});
			});

			describe('Test Case: No rules specified', () => {
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
						'--format', 'xml'
					])
					.it('When no rules are explicitly specified, all rules are run', ctx => {
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be 84 violations. We won't individually check all of them, because we'd be here all day. We'll just
						// make sure there's the right number of them.
						expect(violations.length).to.equal(84, 'Should be 84 violations detected in the file');
					});

				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--target', path.join('test', 'code-fixtures', 'apex', 'AbstractPriceRuleEvaluatorTests.cls'),
						'--format', 'xml',
						'--verbose'
					])
					.it('When the --verbose flag is supplied, info about implicitly run rules is logged', ctx => {
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// Before the violations are logged, there should be 16 log runMessages about implicitly included PMD categories.
						const regex = new RegExp(events.info.categoryImplicitlyRun.replace(/%s/g, '.*'), 'g');
						const implicitMessages = violations[0].match(regex);
						expect(implicitMessages || []).to.have.lengthOf(15, 'Should be 15 log entries for implicitly added categories from pmd and eslint');
					});
			});

			describe('Test Case: Evaluating rules against invalid code', () => {
				const pathToBadSyntax = path.join('test', 'code-fixtures', 'invalid-apex', 'BadSyntax1.cls');
				const pathToGoodSyntax = path.join('test', 'code-fixtures', 'apex', 'AccountServiceTests.cls');
				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--ruleset', 'ApexUnit',
						'--target', pathToBadSyntax,
						'--format', 'xml'
					])
					.it('When only malformed code is supplied, no violations are detected but a warning is logged', ctx => {
						// Expect the output to include the "No violations" string.
						expect(ctx.stdout).to.contain(runMessages.getMessage('output.noViolationsDetected'), 'No violations should be found');
						// Expect stderr to include the warning indicating that the file's output was skipped. We don't care much
						// about the message from PMD, so just replace it with an empty string so it doesn't fail anything.
						expect(ctx.stderr).to.contain(eventMessages.getMessage('warning.pmdSkippedFile', [path.resolve(pathToBadSyntax), '']), 'Warning should be displayed');
					});

				runTest
					.stdout()
					.stderr()
					.command(['scanner:run',
						'--ruleset', 'ApexUnit',
						'--target', `${pathToBadSyntax},${pathToGoodSyntax}`,
						'--format', 'xml'
					])
					.it('When a malformed file and a valid file are supplied, the malformed file does not tank the process', ctx => {
						// stdout should be the same as if we'd only run against the good file.
						// We'll split the output by the <violation> tag, so we can get individual violations.
						const violations = ctx.stdout.split('<violation');
						// The first list item is going to be the header, so we need to pull that off.
						violations.shift();
						// There should be four violations.
						expect(violations.length).to.equal(4, 'Should be four violations detected in the file');
						// We'll check each violation in enough depth to be confident that the expected violations were returned in the
						// expected order.
						expect(violations[0]).to.match(/line="68".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[1]).to.match(/line="72".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[2]).to.match(/line="76".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						expect(violations[3]).to.match(/line="80".+rule="ApexUnitTestClassShouldHaveAsserts"/);
						// stderr should include the warning indicating that the file was skipped.
						expect(ctx.stderr).to.contain(eventMessages.getMessage('warning.pmdSkippedFile', [path.resolve(pathToBadSyntax), '']), 'Warning should be displayed');
					});
			});
		});

		describe('Error handling', () => {
			runTest
				.stdout()
				.stderr()
				.command(['scanner:run', '--ruleset', 'ApexUnit', '--format', 'xml'])
				.it('Error thrown when no target is specified', ctx => {
					expect(ctx.stderr).to.contain(`ERROR running scanner:run:  ${runMessages.getMessage('validations.mustTargetSomething')}`);
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run', '--target', 'path/that/does/not/matter', '--ruleset', 'ApexUnit', '--outfile', 'NotAValidFileName'])
				.it('Error thrown when output file is malformed', ctx => {
					expect(ctx.stderr).to.contain(`ERROR running scanner:run:  ${runMessages.getMessage('validations.outfileMustBeValid')}`);
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run', '--target', 'path/that/does/not/matter', '--ruleset', 'ApexUnit', '--outfile', 'badtype.pdf'])
				.it('Error thrown when output file is unsupported type', ctx => {
					expect(ctx.stderr).to.contain(`ERROR running scanner:run:  ${runMessages.getMessage('validations.outfileMustBeSupportedType')}`);
				});

			runTest
				.stdout()
				.stderr()
				.command(['scanner:run', '--target', 'path/that/does/not/matter', '--format', 'csv', '--outfile', 'notcsv.xml'])
				.it('Warning logged when output file format does not match format', ctx => {
					expect(ctx.stdout).to.contain(runMessages.getMessage('validations.outfileFormatMismatch', ['csv', 'xml']));
				});
		});
	});

	describe('MultiEngine', () => {
		describe('Project: JS', () => {
			before(() => {
				process.chdir(path.join('test', 'code-fixtures', 'projects'))
			});
			after(() => {
				process.chdir("../../..");
			});
			runTest
				.stdout()
				.stderr()
				.command(['scanner:run', '--target', 'js', '--format', 'json'])
				.it('JS project triggers pmd and eslint rules', ctx => {
					expect(ctx.stderr).to.be.empty;
					const results = JSON.parse(ctx.stdout.substring(ctx.stdout.indexOf("[{")));
					expect(results).to.be.an("array").that.has.length(2);
					for (const result of results) {
						expect(result.violations[0], `Message is ${result.violations[0].message}`).to.have.property("ruleName").that.is.not.null;
					}
				});
		});
	});
});
