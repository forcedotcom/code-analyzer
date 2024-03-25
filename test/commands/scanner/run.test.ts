import {expect} from 'chai';
import {runCommand} from '../../TestUtils';
import {BundleName, getMessage} from "../../../src/MessageCatalog";
import * as os from "os";
import {ENV_VAR_NAMES} from "../../../src/Constants";
import fs = require('fs');
import path = require('path');
import process = require('process');

const pathToSomeTestClass = path.join('test', 'code-fixtures', 'apex', 'SomeTestClass.cls');
const pathToAnotherTestClass = path.join('test', 'code-fixtures', 'apex', 'AnotherTestClass.cls');
const pathToYetAnotherTestClass = path.join('test', 'code-fixtures', 'apex', 'YetAnotherTestClass.cls');

describe('scanner run', function () {
	describe('E2E', () => {
		describe('Output Type: XML', () => {

			function validateNoViolationsXmlOutput(xml: string): void {
				// We'll split the output by the <violation> tag, so we can get individual violations.
				// we expect no violations
				expect(xml.indexOf('<violation')).to.equal(-1, `Should be no violations detected in the file:\n ${xml}`);
			}

			describe('Test Case: Running rules against a single file', () => {
				it('When the file contains violations, they are logged out as an XML', () => {
					const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format xml`);
					assertNoError(output);
					validateXmlOutput(output.shellOutput.stdout);
				});

				it('When the file contains no violations, a message is logged to the console', () => {
					const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --format xml`);
					assertNoError(output);
					expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, retire-js']));
				});
			});

			describe('Test Case: Writing XML results to a file', () => {
				const testout = 'testout.xml';
				afterEach(() => {
					if (fs.existsSync(testout)) {
						fs.unlinkSync(testout);
					}
				});

				it('Returned violations are written to file as XML', () => {
					runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${testout}`);
					// Verify that the file we wanted was actually created.
					expect(fs.existsSync(testout)).to.equal(true, 'The command should have created the expected output file');
					const fileContents = fs.readFileSync(testout).toString();
					validateXmlOutput(fileContents);
				});

				it('Absence of violations yields empty XML file', () => {
					runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --outfile ${testout}`);
					// Verify that an empty XML file was actually created.
					expect(fs.existsSync(testout)).to.equal(true, 'The command should have created an empty output file');
					const fileContents = fs.readFileSync(testout).toString();
					validateNoViolationsXmlOutput(fileContents);
				});
			});
		});

		describe('Output Type: CSV', () => {
			function validateCsvOutput(contents: string, expectSummary=true): void {
				// If there's a summary, then it'll be separated from the CSV by an empty line.
				const [csv, summary] = contents.trim().split(/\n\r?\n/);
				if (expectSummary) {
					expect(summary).to.not.equal(undefined, 'Expected summary to be not undefined');
					expect(summary).to.not.equal(null, 'Expected summary to be not null');
					expect(summary).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.engineSummaryTemplate', ['pmd', 2, 1]), 'Summary should be correct');
				}
				// Since it's a CSV, the rows themselves are separated by newline characters, and there's a header row we
				// need to discard.
				const rows = csv.trim().split('\n');
				rows.shift();

				// There should be at least two rows.
				expect(rows.length).to.be.greaterThanOrEqual(2, 'Should be two or more violations detected');

				let numMatches = 0
				for (const row of rows) {
					const data = row.split(',')
					numMatches += (data[3] == `"11"` || data[3] == `"19"`) && data[5] == `"ApexUnitTestClassShouldHaveAsserts"` ? 1 : 0;
				}
				expect(numMatches).to.equal(2, `Should have violations of ApexUnitTestClassShouldHaveAsserts at line 11 and at line 19.`);
			}

			function validateNoViolationsCsvOutput(contents: string, expectSummary=true): void {
				// If there's a summary, then it'll be separated from the CSV by an empty line.
				const [csv, summary] = contents.trim().split(/\n\r?\n/);
				if (expectSummary) {
					expect(summary).to.not.equal(undefined, 'Expected summary to be not undefined');
					expect(summary).to.not.equal(null, 'Expected summary to be not null');
					expect(summary).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.engineSummaryTemplate', ['pmd', 2, 1]), 'Summary should be correct');
				}

				// Since it's a CSV, the rows themselves are separated by newline characters.
				// Test to check there are no violations.
				// There should be a header and no other lines, meaning no newline characters.
				expect(csv.indexOf('\n')).to.equal(-1, "Should be no violations detected");
			}

			const testout = 'testout.csv';
			afterEach(() => {
				if (fs.existsSync(testout)) {
					fs.unlinkSync(testout);
				}
			});

			it('Properly writes CSV to console', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format csv`);
				assertNoError(output);
				validateCsvOutput(output.shellOutput.stdout, false);
			});

			it('Properly writes CSV to file', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${testout}`);
				assertNoError(output);
				// Verify that the correct message is displayed to user
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.engineSummaryTemplate', ['pmd', 7, 1]), 'Expected summary to be correct');
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [testout]));

				// Verify that the file we wanted was actually created.
				expect(fs.existsSync(testout)).to.equal(true, 'The command should have created the expected output file');
				const fileContents = fs.readFileSync(testout).toString();
				validateCsvOutput(fileContents, false);
			});

			it('When no violations are detected, a message is logged to the console', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --format csv`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, retire-js']));
			});

			it('When --outfile is provided and no violations are detected, CSV file with no violations is created', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --outfile ${testout}`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [testout]));

				const fileContents = fs.readFileSync(testout).toString();
				expect(fs.existsSync(testout)).to.be.true;
				validateNoViolationsCsvOutput(fileContents, false);
			});
		});

		describe('Output Type: HTML', () => {
			const outputFile = 'testout.hTmL';
			function validateHtmlOutput(html: string): void {
				const result = html.match(/const violations = (\[.*);/);
				expect(result).to.be.not.null;
				expect(result[1]).to.be.not.null;
				const rows = JSON.parse(result[1]);

				expect(rows.length).to.be.greaterThanOrEqual(2);

				let numMatches = 0
				for (const row of rows) {
					numMatches += (row.line == 11 || row.line == 19) && row.ruleName == "ApexUnitTestClassShouldHaveAsserts" ? 1 : 0;
				}
				expect(numMatches).to.equal(2, `Should have violations of ApexUnitTestClassShouldHaveAsserts at line 11 and at line 19.`);
			}

			function validateNoViolationsHtmlOutput(html: string): void {
				// there should be no instance of a filled violations object
				const result = html.match(/const violations = (\[.+\]);/);
				expect(result).to.be.null;
				// there should be an empty violations object
				const emptyResult = html.match(/const violations = \[\];/);
				expect(emptyResult).to.be.not.null;
			}

			afterEach(() => {
				if (fs.existsSync(outputFile)) {
					fs.unlinkSync(outputFile);
				}
			});

			it('Properly writes HTML to console', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format html`);
				assertNoError(output);
				validateHtmlOutput(output.shellOutput.stdout);
			});

			it('Properly writes HTML to file', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${outputFile}`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [outputFile]));

				// Verify that the file we wanted was actually created.
				expect(fs.existsSync(outputFile)).to.equal(true, 'The command should have created the expected output file');
				const fileContents = fs.readFileSync(outputFile).toString();
				validateHtmlOutput(fileContents);
			});

			it('When no violations are detected, a message is logged to the console', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --format html`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, retire-js']));
			});

			it('When --outfile is provided and no violations are detected, HTML file with no violations should be created', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --outfile ${outputFile}`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [outputFile]));
				expect(fs.existsSync(outputFile)).to.be.true;
				const fileContents = fs.readFileSync(outputFile).toString();
				validateNoViolationsHtmlOutput(fileContents);
			});
		});

		describe('Output Type: JSON', () => {
			function validateNoViolationsJsonOutput(json: string): void {
				const output = JSON.parse(json);
				// There should be no violations.
				expect(output.length).to.equal(0, 'Should be no violations from one engine');
			}

			const testout = 'testout.json';
			afterEach(() => {
				if (fs.existsSync(testout)) {
					fs.unlinkSync(testout);
				}
			});

			it('Properly writes JSON to console', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format json`);
				assertNoError(output);
				const stdout = output.shellOutput.stdout;
				validateJsonOutput(stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1));
			});

			it('Properly writes JSON to file', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${testout}`);
				assertNoError(output);
				// Verify that the correct message is displayed to user
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.engineSummaryTemplate', ['pmd', 7, 1]), 'Expected summary to be correct');
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [testout]));

				// Verify that the file we wanted was actually created.
				expect(fs.existsSync(testout)).to.equal(true, 'The command should have created the expected output file');
				const fileContents = fs.readFileSync(testout).toString();
				validateJsonOutput(fileContents);
			});

			it('When no violations are detected, a message is logged to the console', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --format json`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, retire-js']));
			});

			it('When --outfile is provided and no violations are detected, a JSON file with no violations is created', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --outfile ${testout}`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [testout]));
				expect(fs.existsSync(testout)).to.be.true;
				const fileContents = fs.readFileSync(testout).toString();
				validateNoViolationsJsonOutput(fileContents);
			});

		});

		describe('Output Type: Table', () => {
			// The table can't be written to a file, so we're just testing the console.
			it('Properly writes table to the console', () => {
				const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format table`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.match(/SomeTestClass.cls:11[^\n]+Apex unit tests should System\.assert/)
				expect(output.shellOutput.stdout).to.match(/SomeTestClass.cls:19[^\n]+Apex unit tests should System\.assert/)
			});

			it('When no violations are detected, an empty table is logged to the console', () => {
				const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --format table`);
				assertNoError(output);
				expect(output.shellOutput.stdout).to.not.contain("SomeTestClass.cls")
			});
		});

		describe('--json flag', () => {
			const testout = 'testout.xml';
			afterEach(() => {
				if (fs.existsSync(testout)) {
					fs.unlinkSync(testout);
				}
			});

			it('--json flag uses default format of JSON', () => {
				const commandOutput = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --json`);
				assertNoError(commandOutput);
				const output = JSON.parse(commandOutput.shellOutput.stdout);
				expect(output.status).to.equal(0, 'Should have finished properly');
				validateJsonOutput(JSON.stringify(output.result))
			});

			it('--json flag wraps other formats in a string', () => {
				const commandOutput = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format xml --json`);
				assertNoError(commandOutput);
				const output = JSON.parse(commandOutput.shellOutput.stdout);
				expect(output.status).to.equal(0, 'Should have finished properly');
				validateXmlOutput(output.result);
			});

			it('--json flag wraps message about writing to outfile', () => {
				const commandOutput = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${testout} --json`);
				assertNoError(commandOutput);
				const output = JSON.parse(commandOutput.shellOutput.stdout);
				expect(output.status).to.equal(0, 'Should finish properly');
				const result = output.result;
				expect(result).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.writtenToOutFile', [testout]));
				// Verify that the file we wanted was actually created.
				expect(fs.existsSync(testout)).to.equal(true, 'The command should have created the expected output file');
				const fileContents = fs.readFileSync(testout).toString();
				validateXmlOutput(fileContents);
			});

			it('--json flag wraps message about no violations occuring', () => {
				const commandOutput = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --category "Best Practices" --json`);
				assertNoError(commandOutput);
				const output = JSON.parse(commandOutput.shellOutput.stdout);
				expect(output.status).to.equal(0, 'Should have finished properly');
				expect(output.result).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, retire-js']));
			})
		});

		describe('Edge Cases', () => {
			describe('Test case: No output specified', () => {
				it('When no format is specified, we default to a TABLE', () => {
					const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices"`);
					assertNoError(output);
					expect(output.shellOutput.stdout).to.match(/SomeTestClass.cls:11[^\n]+Apex unit tests should System\.assert/)
					expect(output.shellOutput.stdout).to.match(/SomeTestClass.cls:19[^\n]+Apex unit tests should System\.assert/)
				})
			});

			describe('Test Case: No rules specified', () => {
				it('When no rules are explicitly specified, all rules are run', () => {
					const output = runCommand(`scanner run --target ${pathToAnotherTestClass} --format xml`);
					assertNoError(output);
					// We'll split the output by the <violation> tag, so we can get individual violations.
					const violations = output.shellOutput.stdout.split('<violation');
					// The first list item is going to be the header, so we need to pull that off.
					violations.shift();
					// ApexUnitTestClassShouldHaveAsserts, FieldNamingConventions, UnusedLocalVariable, and VariableNamingConventions
					// We'll just make sure that we have the right number of them.
					expect(violations.length).greaterThan(0);
				});
			});
		});

		describe('Error handling', () => {
			const notcsv = 'notcsv.xml';
			afterEach(() => {
				if (fs.existsSync(notcsv)) {
					fs.unlinkSync(notcsv);
				}
			});


			it('Error thrown when output file is malformed', () => {
				const output = runCommand(`scanner run --target path/that/does/notmatter --category "Best Practices" --outfile NotAValidFileName`);
				expect(output.shellOutput.stderr).to.contain(`Error (1): ${getMessage(BundleName.CommonRun, 'validations.outfileMustBeValid')}`);
			});

			it('Error thrown when output file is unsupported type', () => {
				const output = runCommand(`scanner run --target path/that/does/not/matter --category "Best Practices" --outfile badtype.pdf`);
				expect(output.shellOutput.stderr).to.contain(`Error (1): ${getMessage(BundleName.CommonRun, 'validations.outfileMustBeSupportedType')}`);
			})

			it('Warning logged when output file format does not match format', () => {
				const output = runCommand(`scanner run --target path/that/does/not/matter --format csv --outfile ${notcsv}`);
				expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.CommonRun, 'validations.outfileFormatMismatch', ['csv', 'xml']));
			});
		});
	});

	describe('MultiEngine', () => {
		describe('Project: JS', () => {
			it('Polyglot project triggers pmd and eslint rules', () => {
				const pathToApp = path.join('test', 'code-fixtures', 'projects', 'app');
				const allJsGlob = path.join(pathToApp, '**', '*.js');
				const allApexGlob = path.join(pathToApp, '**', '*.cls');
				const output = runCommand(`scanner run --target "${allJsGlob},${allApexGlob}" --format json`);
				assertNoError(output);
				const results = JSON.parse(output.shellOutput.stdout.substring(output.shellOutput.stdout.indexOf("[{"), output.shellOutput.stdout.lastIndexOf("}]") + 2));
				// Look through all of the results and gather a set of unique engines
				const uniqueEngines = new Set(results.map(r => { return r.engine }));
				expect(uniqueEngines).to.be.an("Set").that.has.length(2);
				expect(uniqueEngines).to.contain("eslint");
				expect(uniqueEngines).to.contain("pmd");
				// Validate that all of the results have an expected property
				for (const result of results) {
					expect(result.violations[0], `Message is ${result.violations[0].message}\n ${output.shellOutput.stdout}`).to.have.property("ruleName").that.is.not.null;
				}
			});
		});
	});

	describe('BaseConfig Environment Tests For Javascript', () => {
		it('The baseConfig enables the usage of default Javascript Types', () => {
			const output = runCommand(`scanner run --target ${path.join('test', 'code-fixtures', 'projects', 'js', 'src', 'baseConfigEnv.js')} --format csv`);
			assertNoError(output);
			// There should be no violations.
			expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, eslint, retire-js']));
		});

		// TODO: THIS TEST WAS IMPLEMENTED FOR W-7791882. THE FIX FOR THAT BUG WAS SUB-OPTIMAL, AND WE NEED TO CHANGE IT IN 4.0.
		//       DON'T BE AFRAID TO CHANGE/DELETE THIS TEST AT THAT POINT.
		it('By default, frameworks such as QUnit are not included in the baseConfig', () => {
			const output = runCommand(`scanner run --target ${path.join('test', 'code-fixtures', 'projects', 'js', 'src', 'fileThatUsesQUnit.js')} --format json`);
			assertNoError(output);
			// We expect there to be 2 errors about qunit-related syntax being undefined.
			const stdout = output.shellOutput.stdout;
			const parsedCtx = JSON.parse(stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1));
			expect(parsedCtx[0].violations.length).to.equal(2, `Should be 2 violations ${JSON.stringify(parsedCtx[0].violations)}`);
			expect(parsedCtx[0].violations[0].message).to.contain("'QUnit' is not defined.");
		});

		// TODO: THIS TEST WAS IMPLEMENTED FOR W-7791882. THE FIX FOR THAT BUG WAS SUB-OPTIMAL AND WE NEED TO REDO IT IN 4.0.
		//       DON'T BE AFRAID TO CHANGE/DELETE THIS TEST AT THAT POINT.
		it('Providing qunit in the --env override should resolve errors about that framework', () => {
			const output = runCommand(`scanner run --target ${path.join('test', 'code-fixtures', 'projects', 'js', 'src', 'fileThatUsesQUnit.js')} --format json --env "{\\"qunit\\": true}"`);
			assertNoError(output);
			expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.RunOutputProcessor, 'output.noViolationsDetected', ['pmd, eslint, retire-js']));
		});
	});

	describe('run with format --json', () => {
		it('provides only json in stdout', () => {
			const output = runCommand(`scanner run --target ${pathToAnotherTestClass} --format json`);
			assertNoError(output);
			try {
				JSON.parse(output.shellOutput.stdout);
			} catch (error) {
				expect.fail("Invalid JSON output from --format json: " + output.shellOutput.stdout, error);
			}

		});
	});

	describe('Validation on custom config flags', () => {

		it('Handle --tsconfig and --eslintconfig as mutially exclusive flags and throw an informative error message', () => {
			const output = runCommand(`scanner run --target /some/path --tsconfig /some/path/tsconfig.json --eslintconfig /some/path/.eslintrc.json`);
			expect(output.shellOutput.stderr).to.contain(getMessage(BundleName.Run, 'validations.tsConfigEslintConfigExclusive'));
		});

		it('Display informative message when rule filters are provided along with custom config - pmdconfig', () => {
			const output = runCommand(`scanner run --target /some/path --pmdconfig /somepath/ruleref.xml --category Security`);
			expect(output.shellOutput.stdout).to.contain(getMessage(BundleName.Run, 'output.filtersIgnoredCustom'));
		});
	});

	// Any commands that specify the --verbose cause subsequent commands to execute as if --verbose was specified.
	// Put all --verbose commands at the end of this file.
	describe('Verbose tests must come last. Verbose does not reset', () => {
		it('When the --verbose flag is supplied, info about implicitly run rules is logged', () => {
			const output = runCommand(`scanner run --target ${pathToYetAnotherTestClass} --format xml --verbose`);
			assertNoError(output);
			// We'll split the output by the <violation> tag, so we can get individual violations.
			const violations = output.shellOutput.stdout.split('<violation');
			// Before the violations are logged, there should be 16 log runMessages about implicitly included PMD categories.
			const regex = new RegExp(getMessage(BundleName.EventKeyTemplates, 'info.categoryImplicitlyRun', ['.*', '.*']), 'g');
			const implicitMessages = violations[0].match(regex);
			// Note: Please keep this up-to-date. It will make it way easier to debug if needed.
			// The following categories are implicitly included, because they come from default-enabled engines:
			// - 8 PMD categories
			// - 3 ESLint categories
			// - 3 ESLint-Typescript categories
			// - 1 RetireJS category
			// For a total of 15
			// TODO: revisit test, should be improved because of issue above
			console.log(`${JSON.stringify(implicitMessages)}`);
			expect(implicitMessages || []).to.have.lengthOf(15, `Entries for implicitly added categories from all engines:\n ${JSON.stringify(implicitMessages)}`);

		});
	});

	describe('Create internal outfile with SCANNER_INTERNAL_OUTFILE environment variable', () => {
		let tmpDir: string = null;
		beforeEach(() => {
			tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'InternalOutfileTest-'));
		});
		afterEach(() => {
			fs.rmSync(tmpDir, {recursive: true, force: true});
			delete process.env[ENV_VAR_NAMES.SCANNER_INTERNAL_OUTFILE];
		});

		it('Can write a user file and an internal file with different formats at same time', () => {
			const internalOutfile = path.join(tmpDir, "internalOutfile.json");
			process.env[ENV_VAR_NAMES.SCANNER_INTERNAL_OUTFILE] = internalOutfile;
			const userOutfile = path.join(tmpDir, "userOutfile.xml");
			runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${userOutfile}`);

			expect(fs.existsSync(userOutfile)).to.equal(true, 'The command should have created the expected user output file');
			const userFileContents = fs.readFileSync(userOutfile).toString();
			validateXmlOutput(userFileContents);

			expect(fs.existsSync(internalOutfile)).to.equal(true, 'The command should have created the expected internal output file');
			const internalFileContents = fs.readFileSync(internalOutfile).toString();
			validateJsonOutput(internalFileContents);
		});


		it('Can write to internal file and write to console', () => {
			const internalOutfile = path.join(tmpDir, "internalOutfile.json");
			process.env[ENV_VAR_NAMES.SCANNER_INTERNAL_OUTFILE] = internalOutfile;
			const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --format xml`);
			assertNoError(output);
			validateXmlOutput(output.shellOutput.stdout);

			expect(fs.existsSync(internalOutfile)).to.equal(true, 'The command should have created the expected internal output file');
			const internalFileContents = fs.readFileSync(internalOutfile).toString();
			validateJsonOutput(internalFileContents);
		});

		it('Invalid internal file name gives appropriate error', () => {
			const internalOutfile = path.join(tmpDir, "internalOutfile.notSupported");
			process.env[ENV_VAR_NAMES.SCANNER_INTERNAL_OUTFILE] = internalOutfile;
			const userOutfile = path.join(tmpDir, "userOutfile.xml");
			const output = runCommand(`scanner run --target ${pathToSomeTestClass} --category "Best Practices" --outfile ${userOutfile}`);

			expect(output.shellOutput.stderr).contains(
				getMessage(BundleName.CommonRun, 'internal.outfileMustBeSupportedType', [ENV_VAR_NAMES.SCANNER_INTERNAL_OUTFILE]));
		});
	});
});

function validateXmlOutput(xml: string): void {
	expect(xml.match(/<violation/g).length).to.be.greaterThanOrEqual(2, `Should be at least two violations detected in the file:\n ${xml}`);
	expect(xml).to.match(/line="11"[^\n]+rule="ApexUnitTestClassShouldHaveAsserts"/);
	expect(xml).to.match(/line="19"[^\n]+rule="ApexUnitTestClassShouldHaveAsserts"/);
}

function validateJsonOutput(json: string): void {
	const output = JSON.parse(json);
	// Only PMD rules should have run.
	expect(output.length).to.equal(1, 'Should only be violations from one engine');
	expect(output[0].engine).to.equal('pmd', 'Engine should be PMD');

	let numMatches = 0
	for (const violation of output[0].violations) {
		numMatches += (violation.line == 11 || violation.line == 19) && violation.ruleName == "ApexUnitTestClassShouldHaveAsserts" ? 1 : 0;
	}
	expect(numMatches).to.equal(2, `Should have violations of ApexUnitTestClassShouldHaveAsserts at line 11 and at line 19.`);
}

function assertNoError(output) {
	if (output.shellOutput.stderr.includes("Error")) {
		expect.fail("Found error in stderr output:\n" + output.shellOutput.stderr);
	}
}
