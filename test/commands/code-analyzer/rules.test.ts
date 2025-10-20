import RulesCommand from '../../../src/commands/code-analyzer/rules';
import { RulesAction, RulesDependencies, RulesInput } from '../../../src/lib/actions/RulesAction';
import { RuleDetailDisplayer, RulesNoOpDisplayer, RuleTableDisplayer } from '../../../src/lib/viewers/RuleViewer';
import { CompositeRulesWriter } from '../../../src/lib/writers/RulesWriter';
import {Config} from '@oclif/core';
import * as path from 'node:path';
import { ConsoleOuputInterceptor } from '../../test-utils';

const rootFolderWithPackageJson: string = path.join(__dirname, '..', '..', '..');
const config: Config = new Config({ root: rootFolderWithPackageJson });

function runRulesCommand(userArgs: string[]): Promise<void> {
	const command: RulesCommand = new RulesCommand(userArgs, config);
	return command.run();
}

describe('`code-analyzer config` end to end tests', () => {
	const origDir: string = process.cwd();
	const exampleWorkspace: string = path.resolve(rootFolderWithPackageJson, 'test','fixtures', 'example-workspaces', 'workspace-with-misc-files');
	
	beforeAll(async () => {
		process.chdir(exampleWorkspace);
		await config.load();
	});

	afterAll(async () => {
		process.chdir(origDir);
	});

	it('Testing default arguments', async () => {
		// This test is more of a sanity check that when we run end to end we don't blow up.
		const outputInterceptor: ConsoleOuputInterceptor = new ConsoleOuputInterceptor();
		try {
			outputInterceptor.start();
			await runRulesCommand([]);
		} finally {
			outputInterceptor.stop();
		}
		expect(outputInterceptor.out).toContain('cpd rule(s) found');
		expect(outputInterceptor.out).toContain('eslint rule(s) found');
		expect(outputInterceptor.out).toContain('retire-js rule(s) found');
		expect(outputInterceptor.out).toContain('regex rule(s) found');
		expect(outputInterceptor.out).toContain('pmd rule(s) found');
	});
});

describe('`code-analyzer rules` unit tests', () => {
	beforeAll(async () => {
		await config.load();
	});

	let executeSpy: ReturnType<typeof vi.spyOn>
	let createActionSpy: ReturnType<typeof vi.spyOn>
	let fromFilesSpy: ReturnType<typeof vi.spyOn>
	let receivedActionInput: RulesInput;
	let receivedActionDependencies: RulesDependencies;
	let receivedFiles: string[];

	beforeEach(() => {
		executeSpy = vi.spyOn(RulesAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		const originalCreateAction = RulesAction.createAction;
		createActionSpy = vi.spyOn(RulesAction, 'createAction').mockImplementation((dependencies) => {
			receivedActionDependencies = dependencies;
			return originalCreateAction(dependencies);
		});
		const originalFromFiles = CompositeRulesWriter.fromFiles;
		fromFilesSpy = vi.spyOn(CompositeRulesWriter, 'fromFiles').mockImplementation(files => {
			receivedFiles = files;
			return originalFromFiles(files);
		})
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await runRulesCommand(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['ab,cde', 'def:gh'];
			await runRulesCommand(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await runRulesCommand(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['ab,cde', 'hi:jlk'];
			const inputValue2 = ['de:(a,b):fgh', 'mnopq'];
			await runRulesCommand(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ['ab,cde', 'hi:jlk', 'de:(a,b):fgh', 'mnopq']);
		});

		it('Defaults to value of "Recommended"', async () => {
			await runRulesCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["Recommended"]);
		})

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await runRulesCommand(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await runRulesCommand(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = runRulesCommand(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = runRulesCommand(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await runRulesCommand(['-c', inputValue]);
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
			await runRulesCommand(['--output-file', inputValue1]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1]);
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			await runRulesCommand(['--output-file', `${inputValue1},${inputValue2}`]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with one value each', async () => {
			await runRulesCommand(['--output-file', inputValue1, '--output-file', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			await runRulesCommand(['--output-file', `${inputValue1},${inputValue2}`, '--output-file', `${inputValue3},${inputValue4}`]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1, inputValue2, inputValue3, inputValue4]);
			expect(fromFilesSpy).toHaveBeenCalled()
			expect(receivedFiles).toEqual([inputValue1, inputValue2, inputValue3, inputValue4]);
		});

		it('Can be referenced by its shortname, -f', async () => {
			await runRulesCommand(['-f', inputValue1]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', [inputValue1]);
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1]);
		});

		it('Is optional', async () => {
			await runRulesCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([]);
		});
	});

	describe('--view', () => {
		it('Accepts the value, "table"', async () => {
			const inputValue = 'table';
			await runRulesCommand(['--view', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleTableDisplayer');
		});

		it('Accepts the value, "detail"', async () => {
			const inputValue = 'detail';
			await runRulesCommand(['--view', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleDetailDisplayer');
		});

		it('Rejects all other values', async () => {
			const inputValue = 'beep';
			const executionPromise = runRulesCommand(['--view', inputValue]);
			await expect(executionPromise).rejects.toThrow(`Expected --view=${inputValue} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Defaults to value of "table"', async () => {
			await runRulesCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.viewer.constructor.name).toEqual('RuleTableDisplayer');
		});

		it('Can be supplied only once', async () => {
			const inputValue1 = 'detail';
			const inputValue2 = 'table';
			const executionPromise = runRulesCommand(['--view', inputValue1, '--view', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --view can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -v', async () => {
			// Use a non-default value, so we know that the flag's value comes from our input and not the default.
			const inputValue = 'detail';
			await runRulesCommand(['-v', inputValue]);
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
			await runRulesCommand([flag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await runRulesCommand([flag, inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await runRulesCommand([flag, inputValue1, flag, inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somedirectory', './anotherdirectory'];
			const inputValue2 = ['./someotherdirectory', './yetanotherdirectory'];
			await runRulesCommand([flag, inputValue1.join(','), flag, inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [...inputValue1, ...inputValue2]);
		});

		it('Is unused if not directly specified', async () => {
			await runRulesCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput.workspace).toBeUndefined();
		});

		it(`Can be referenced by its shortname, ${shortflag}`, async () => {
			const inputValue = './somedirectory';
			await runRulesCommand([shortflag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});
	});

	describe('Flag interactions', () => {
		describe('--output-file and --view', () => {
			it('When --output-file and --view is set to "detail", writer is set and view is set to "detail" display', async () => {
				const outfileInput = 'rules-output.json';
				const viewInput = 'detail';
				await runRulesCommand(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleDetailDisplayer);
			});

			it('When --output-file and --view is set to "table", writer is set and view is set to "table" display', async () => {
				const outfileInput = 'rules-output.json';
				const viewInput = 'table';
				await runRulesCommand(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleTableDisplayer);
			});

			it('When --output-file is present and --view is not, view is set to a noop display', async () => {
				const outfileInput= 'rules-output.json';
				await runRulesCommand(['--output-file', outfileInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RulesNoOpDisplayer);
			});

			it('When --output-file and --view are both absent, writer is not set and --view defaults to "table" display', async () => {
				await runRulesCommand([]);
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([]);
				expect(receivedActionDependencies.viewer.constructor).toEqual(RuleTableDisplayer);
			});
		});
	});
});
