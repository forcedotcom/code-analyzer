import {stubSfCommandUx} from '@salesforce/sf-plugins-core';
import {TestContext} from '@salesforce/core/lib/testSetup';
import ConfigCommand from '../../../src/commands/code-analyzer/config';
import {ConfigAction, ConfigInput} from '../../../src/lib/actions/ConfigAction';
import {ConfigFileWriter} from '../../../src/lib/writers/ConfigWriter';
import {SpyDisplay} from '../../stubs/SpyDisplay';

describe('`code-analyzer config` tests', () => {
	const $$ = new TestContext();

	let executeSpy: jest.SpyInstance;
	let createActionSpy: jest.SpyInstance;
	let receivedActionInput: ConfigInput;

	beforeEach(() => {
		stubSfCommandUx($$.SANDBOX);
		executeSpy = jest.spyOn(ConfigAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		const originalCreateAction = ConfigAction.createAction;
		createActionSpy = jest.spyOn(ConfigAction, 'createAction').mockImplementation((dependencies) => {
			return originalCreateAction(dependencies);
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await ConfigCommand.run(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['abc,(asdf:eee):de', 'de:fgh'];
			await ConfigCommand.run(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await ConfigCommand.run(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['ab,(qq:zz),cde', 'hijlk'];
			const inputValue2 = ['defgh', 'mnopq'];
			await ConfigCommand.run(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ['ab,(qq:zz),cde', 'hijlk',  'defgh', 'mnopq']);
		});

		it('Defaults to value of "all"', async () => {
			await ConfigCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["all"]);
		})

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await ConfigCommand.run(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await ConfigCommand.run(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = ConfigCommand.run(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await ConfigCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput['config-file']).toBeUndefined();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = ConfigCommand.run(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await ConfigCommand.run(['-c', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});
	});

	describe.each([
		{flag: '--workspace', shortflag: '-w', property: 'workspace'},
		{flag: '--target', shortflag: '-t', property: 'target'}
	])('$flag', ({flag, shortflag, property}) => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somedirectory';
			await ConfigCommand.run([flag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await ConfigCommand.run([flag, inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await ConfigCommand.run([flag, inputValue1, flag, inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue1, inputValue2]);
		});

		it('Is unused if not directly specified', async () => {
			await ConfigCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput[property]).toBeUndefined();
		});

		it(`Can be referenced by its shortname, ${shortflag}`, async () => {
			const inputValue = './somedirectory';
			await ConfigCommand.run([shortflag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});
	});

	describe('--output-file', () => {

		let fromFileSpy: jest.SpyInstance;
		let receivedFile: string|null;

		beforeEach(() => {
			const originalFromFile = ConfigFileWriter.fromFile;
			fromFileSpy = jest.spyOn(ConfigFileWriter, 'fromFile').mockImplementation(file => {
				receivedFile = file;
				return originalFromFile(file, new SpyDisplay());
			});
		});


		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.yml';
			await ConfigCommand.run(['--output-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).toHaveBeenCalled();
			expect(receivedFile).toEqual(inputValue);
			expect(receivedActionInput).toHaveProperty('output-file', inputValue);
		});

		it('Can be referenced by its shortname, -f', async () => {
			const inputValue = './somefile.yml';
			await ConfigCommand.run(['-f', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).toHaveBeenCalled();
			expect(receivedFile).toEqual(inputValue);
			expect(receivedActionInput).toHaveProperty('output-file', inputValue);
		});

		it('Cannot be supplied multiple times', async () => {
			const inputValue1 = './somefile.yml';
			const inputValue2 = './someotherfile.yml';
			const executionPromise = ConfigCommand.run(['--output-file', inputValue1, '--output-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --output-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await ConfigCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).not.toHaveBeenCalled();
			expect(receivedActionInput['output-file']).toBeUndefined();
		});
	});
});
