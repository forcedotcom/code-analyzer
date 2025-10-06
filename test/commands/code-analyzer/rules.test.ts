import { TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import path from 'node:path';
import RulesCommand from '../../../src/commands/code-analyzer/rules';
import { RulesAction, RulesDependencies, RulesInput } from '../../../src/lib/actions/RulesAction';
import { RuleDetailDisplayer, RulesNoOpDisplayer, RuleTableDisplayer } from '../../../src/lib/viewers/RuleViewer';
import { CompositeRulesWriter } from '../../../src/lib/writers/RulesWriter';

describe('`code-analyzer rules` tests', () => {
	const $$ = new TestContext();

	let executeSpy: jest.SpyInstance;
	let createActionSpy: jest.SpyInstance;
	let fromFilesSpy: jest.SpyInstance;
	let receivedActionInput: RulesInput;
	let receivedActionDependencies: RulesDependencies;

	let receivedFiles: string[];

	beforeEach(() => {
		stubSfCommandUx($$.SANDBOX);
		executeSpy = jest.spyOn(RulesAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		const originalCreateAction = RulesAction.createAction;
		createActionSpy = jest.spyOn(RulesAction, 'createAction').mockImplementation((dependencies) => {
			receivedActionDependencies = dependencies;
			return originalCreateAction(dependencies);
		});
		const originalFromFiles = CompositeRulesWriter.fromFiles;
		fromFilesSpy = jest.spyOn(CompositeRulesWriter, 'fromFiles').mockImplementation(files => {
			receivedFiles = files;
			return originalFromFiles(files);
		})
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await RulesCommand.run(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['ab,cde', 'def:gh'];
			await RulesCommand.run(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await RulesCommand.run(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['ab,cde', 'hi:jlk'];
			const inputValue2 = ['de:(a,b):fgh', 'mnopq'];
			await RulesCommand.run(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [...inputValue1, ...inputValue2]);
		});

		it('Defaults to value of "Recommended"', async () => {
			await RulesCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["Recommended"]);
		})

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await RulesCommand.run(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await RulesCommand.run(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = RulesCommand.run(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = RulesCommand.run(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await RulesCommand.run(['-c', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});
	});

	describe('--output-file', () => {

		const inputValue1 = path.join('my', 'first', 'rules-output.json');
		const inputValue2 = path.join('my', 'second', 'rules-output.csv');
		const inputValue3 = path.join('my', 'third', 'rules-output.json');
		const inputValue4 = path.join('my', 'fourth', 'rules-output.csv');

		it('Can be supplied once with a single value', async () => {
			await RulesCommand.run(['--output-file', inputValue1]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1]);
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			await RulesCommand.run(['--output-file', `${inputValue1},${inputValue2}`]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with one value each', async () => {
			await RulesCommand.run(['--output-file', inputValue1, '--output-file', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			await RulesCommand.run(['--output-file', `${inputValue1},${inputValue2}`, '--output-file', `${inputValue3},${inputValue4}`]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2, inputValue3, inputValue4]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2, inputValue3, inputValue4]);
		});

		it('Can be referenced by its shortname, -f', async () => {
			await RulesCommand.run(['-f', inputValue1]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1]);
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1]);
		});

		it('Is optional', async () => {
			await RulesCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([]);
		});
	});

	describe('--view', () => {
		it('Accepts the value, "table"', async () => {
			const inputValue = 'table';
			await RulesCommand.run(['--view', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleTableDisplayer');
		});

		it('Accepts the value, "detail"', async () => {
			const inputValue = 'detail';
			await RulesCommand.run(['--view', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleDetailDisplayer');
		});

		it('Rejects all other values', async () => {
			const inputValue = 'beep';
			const executionPromise = RulesCommand.run(['--view', inputValue]);
			await expect(executionPromise).rejects.toThrow(`Expected --view=${inputValue} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Defaults to value of "table"', async () => {
			await RulesCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleTableDisplayer');
		});

		it('Can be supplied only once', async () => {
			const inputValue1 = 'detail';
			const inputValue2 = 'table';
			const executionPromise = RulesCommand.run(['--view', inputValue1, '--view', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --view can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -v', async () => {
			// Use a non-default value, so we know that the flag's value comes from our input and not the default.
			const inputValue = 'detail';
			await RulesCommand.run(['-v', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleDetailDisplayer');
		});
	});

	describe.each([
		{flag: '--workspace', shortflag: '-w', property: 'workspace'},
		{flag: '--target', shortflag: '-t', property: 'target'},
	])('$flag', ({flag, shortflag, property}) => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somedirectory';
			await RulesCommand.run([flag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await RulesCommand.run([flag, inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await RulesCommand.run([flag, inputValue1, flag, inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somedirectory', './anotherdirectory'];
			const inputValue2 = ['./someotherdirectory', './yetanotherdirectory'];
			await RulesCommand.run([flag, inputValue1.join(','), flag, inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [...inputValue1, ...inputValue2]);
		});

		it('Is unused if not directly specified', async () => {
			await RulesCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput.workspace).toBeUndefined();
		});

		it(`Can be referenced by its shortname, ${shortflag}`, async () => {
			const inputValue = './somedirectory';
			await RulesCommand.run([shortflag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});
	});

	describe('Flag interactions', () => {
		describe('--output-file and --view', () => {
			it('When --output-file and --view is set to "detail", writer is set and view is set to "detail" display', async () => {
				const outfileInput = 'rules-output.json';
				const viewInput = 'detail';
				await RulesCommand.run(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleDetailDisplayer);
			});

			it('When --output-file and --view is set to "table", writer is set and view is set to "table" display', async () => {
				const outfileInput = 'rules-output.json';
				const viewInput = 'table';
				await RulesCommand.run(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleTableDisplayer);
			});

			it('When --output-file is present and --view is not, view is set to a noop display', async () => {
				const outfileInput= 'rules-output.json';
				await RulesCommand.run(['--output-file', outfileInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RulesNoOpDisplayer);
			});

			it('When --output-file and --view are both absent, writer is not set and --view defaults to "table" display', async () => {
				await RulesCommand.run([]);
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleTableDisplayer);
			});
		});
	});
});
