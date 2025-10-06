import {stubSfCommandUx} from '@salesforce/sf-plugins-core';
import {TelemetryData} from '@salesforce/code-analyzer-core';
import {TestContext} from '@salesforce/core/lib/testSetup';
import RunCommand from '../../../src/commands/code-analyzer/run';
import {RunAction, RunDependencies, RunInput} from '../../../src/lib/actions/RunAction';
import {CompositeResultsWriter} from '../../../src/lib/writers/ResultsWriter';
import {SfCliTelemetryEmitter} from "../../../src/lib/Telemetry";

type TelemetryEmission = {
	source: string,
	eventName: string,
	data: TelemetryData
};

describe('`code-analyzer run` tests', () => {
	const $$ = new TestContext();

	let executeSpy: jest.SpyInstance;
	let createActionSpy: jest.SpyInstance;
	let receivedTelemetryEmissions: TelemetryEmission[];
	let receivedActionInput: RunInput;
	let receivedActionDependencies: RunDependencies;
	let fromFilesSpy: jest.SpyInstance;
	let receivedFiles: string[];
	beforeEach(() => {
		stubSfCommandUx($$.SANDBOX);
		executeSpy = jest.spyOn(RunAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		receivedTelemetryEmissions = [];
		jest.spyOn(SfCliTelemetryEmitter.prototype, 'emitTelemetry').mockImplementation((source, eventName, data) => {
			receivedTelemetryEmissions.push({source, eventName, data});
			return Promise.resolve();
		});
		const originalCreateAction = RunAction.createAction;
		createActionSpy = jest.spyOn(RunAction, 'createAction').mockImplementation((dependencies) => {
			receivedActionDependencies = dependencies;
			return originalCreateAction(dependencies);
		});
		const originalFromFiles = CompositeResultsWriter.fromFiles;
		fromFilesSpy = jest.spyOn(CompositeResultsWriter, 'fromFiles').mockImplementation(files => {
			receivedFiles = files;
			return originalFromFiles(files);
		})
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('--workspace', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somedirectory';
			await RunCommand.run(['--workspace', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await RunCommand.run(['--workspace', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await RunCommand.run(['--workspace', inputValue1, '--workspace', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somedirectory', './anotherdirectory'];
			const inputValue2 = ['./someotherdirectory', './yetanotherdirectory'];
			await RunCommand.run(['--workspace', inputValue1.join(','), '--workspace', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [...inputValue1, ...inputValue2]);
		});

		it('Defaults to value of "."', async () => {
			await RunCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', ['.']);
		});

		it('Can be referenced by its shortname, -w', async () => {
			const inputValue = './somedirectory';
			await RunCommand.run(['-w', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue]);
		});
	});

	describe('--target', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.cls';
			await RunCommand.run(['--target', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somefile.cls', './someotherfile.cls'];
			await RunCommand.run(['--target', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somefile.cls';
			const inputValue2 = './someotherfile.cls';
			await RunCommand.run(['--target', inputValue1, '--target', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somefile.cls', './anotherfile.cls'];
			const inputValue2 = ['./someotherfile.cls', './yetanotherfile.cls'];
			await RunCommand.run(['--target', inputValue1.join(','), '--target', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [...inputValue1, ...inputValue2]);
		});

		it('Can be referenced by its shortname, -t', async () => {
			const inputValue = './somefile.cls';
			await RunCommand.run(['-t', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue]);
		});
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await RunCommand.run(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['abcde', 'defgh'];
			await RunCommand.run(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await RunCommand.run(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['abcde', 'hijlk'];
			const inputValue2 = ['defgh', 'mnopq'];
			await RunCommand.run(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [...inputValue1, ...inputValue2]);
		});

		it('Defaults to value of "Recommended"', async () => {
			await RunCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["Recommended"]);
		});

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await RunCommand.run(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--severity-threshold', () => {
		it.each([
			{sev: '1', exp: 1}, {sev: '2', exp: 2}, {sev: '3', exp: 3}, {sev: '4', exp: 4}, {sev: '5', exp: 5},
			{sev: 'criticAL', exp: 1}, {sev: 'High', exp: 2}, {sev: 'moderate', exp: 3}, {sev: 'low', exp: 4} , {sev: 'info', exp: 5}
		])('Accepts valid severity value: $sev', async ({sev, exp}) => {
			await RunCommand.run(['--severity-threshold', sev]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('severity-threshold', exp);
		});

		it.each([
			{invalidSev: '0', reason: 'it is integer < 1'},
			{invalidSev: '7', reason: 'it is integer > 5'},
			{invalidSev: 'beep', reason: 'it is not a valid severity string'}
		])('Rejects invalid severity $invalidSev because $reason', async ({invalidSev}) => {
			const executionPromise = RunCommand.run(['--severity-threshold', invalidSev]);
			await expect(executionPromise).rejects.toThrow(`Expected --severity-threshold=${invalidSev} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'critical';
			const inputValue2 = 'high';
			const executionPromise = RunCommand.run(['--severity-threshold', inputValue1, '--severity-threshold', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --severity-threshold can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await RunCommand.run([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput['severity-threshold']).toBeUndefined();
		});

		it('Can be referenced by its shortname, -s', async () => {
			const inputValue = `3`
			await RunCommand.run(['-s', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('severity-threshold', parseInt(inputValue));
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await RunCommand.run(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = RunCommand.run(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = RunCommand.run(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await RunCommand.run(['-c', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});
	});

	describe('--output-file', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.json';
			await RunCommand.run(['--output-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somefile.json', './someotherfile.xml'];
			await RunCommand.run(['--output-file', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual(inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somefile.json';
			const inputValue2 = './someotherfile.xml';
			await RunCommand.run(['--output-file', inputValue1, '--output-file', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somefile.json', './someotherfile.xml'];
			const inputValue2 = ['./athirdfile.csv', './afourthfile.json'];
			await RunCommand.run(['--output-file', inputValue1.join(','), '--output-file', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([...inputValue1, ...inputValue2]);
		});

		it('Can be referenced by its shortname, -f', async () => {
			const inputValue = './somefile.json';
			await RunCommand.run(['-f', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue]);
		});
	});

	describe('--view', () => {
		it('Accepts the value, "table"', async () => {
			const inputValue = 'table';
			await RunCommand.run(['--view', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsTableDisplayer');
		});

		it('Accepts the value, "detail"', async () => {
			const inputValue = 'detail';
			await RunCommand.run(['--view', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
		});

		it('Rejects all other values', async () => {
			const inputValue = 'beep';
			const executionPromise = RunCommand.run(['--view', inputValue]);
			await expect(executionPromise).rejects.toThrow(`Expected --view=${inputValue} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be supplied only once', async () => {
			const inputValue1 = 'detail';
			const inputValue2 = 'table';
			const executionPromise = RunCommand.run(['--view', inputValue1, '--view', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --view can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -v', async () => {
			// Use a non-default value, so we know that the flag's value comes from our input and not the default.
			const inputValue = 'detail';
			await RunCommand.run(['-v', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
		});
	});

	describe('Telemetry emission', () => {
		it('Passes telemetry emitter through into Action layer', async () => {
			await RunCommand.run([]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.telemetryEmitter!.constructor.name).toEqual('SfCliTelemetryEmitter');
		});
	});

	describe('Flag interactions', () => {
		describe('--output-file and --view', () => {
			it('When --output-file and --view are both present, both are used', async () => {
				const outfileInput = 'beep.json';
				const viewInput = 'detail';
				await RunCommand.run(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
			});

			it('When --output-file is present and --view is not, --view is a no-op', async () => {
				const outfileInput= 'beep.json';
				await RunCommand.run(['--output-file', outfileInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsNoOpDisplayer');
			});

			it('When --output-file and --view are both absent, --view defaults to "table"', async () => {
				await RunCommand.run([]);
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsTableDisplayer');
			});
		});
	});
});

