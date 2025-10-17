import {TelemetryData} from '@salesforce/code-analyzer-core';
import RunCommand from '../../../src/commands/code-analyzer/run';
import {RunAction, RunDependencies, RunInput} from '../../../src/lib/actions/RunAction';
import {CompositeResultsWriter} from '../../../src/lib/writers/ResultsWriter';
import {SfCliTelemetryEmitter} from "../../../src/lib/Telemetry";
import {ConsoleOuputInterceptor} from '../../test-utils';
import {Config} from '@oclif/core';
import * as path from "path";

type TelemetryEmission = {
	source: string,
	eventName: string,
	data: TelemetryData
};

const rootFolderWithPackageJson: string = path.join(__dirname, '..', '..', '..');
const config: Config = new Config({ root: rootFolderWithPackageJson });
function runRunCommand(userArgs: string[]): Promise<void> {
	const command: RunCommand = new RunCommand(userArgs, config);
	return command.run();
}

describe('`code-analyzer run` end to end tests', () => {
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
			await runRunCommand([]);
		} finally {
			outputInterceptor.stop();
		}

		// Should not throw any unexpected errors
		expect(outputInterceptor.out).not.toContain('threw an unexpected error');

		// Should throw at least the Missing ApexDoc comment violation
		expect(outputInterceptor.out).toContain('Violation file paths relative to');
		expect(outputInterceptor.out).toContain('Missing ApexDoc comment');
	});
});

describe('`code-analyzer run` unit tests', () => {
	beforeAll(async () => {
		await config.load();
	});

	let executeSpy: ReturnType<typeof vi.spyOn>;
	let createActionSpy: ReturnType<typeof vi.spyOn>;
	let receivedTelemetryEmissions: TelemetryEmission[];
	let receivedActionInput: RunInput;
	let receivedActionDependencies: RunDependencies;
	let fromFilesSpy: ReturnType<typeof vi.spyOn>;
	let receivedFiles: string[];
	beforeEach(() => {
		executeSpy = vi.spyOn(RunAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		receivedTelemetryEmissions = [];
		vi.spyOn(SfCliTelemetryEmitter.prototype, 'emitTelemetry').mockImplementation((source, eventName, data) => {
			receivedTelemetryEmissions.push({source, eventName, data});
			return Promise.resolve();
		});
		const originalCreateAction = RunAction.createAction;
		createActionSpy = vi.spyOn(RunAction, 'createAction').mockImplementation((dependencies) => {
			receivedActionDependencies = dependencies;
			return originalCreateAction(dependencies);
		});
		const originalFromFiles = CompositeResultsWriter.fromFiles;
		fromFilesSpy = vi.spyOn(CompositeResultsWriter, 'fromFiles').mockImplementation(files => {
			receivedFiles = files;
			return originalFromFiles(files);
		})
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('--workspace', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somedirectory';
			await runRunCommand(['--workspace', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await runRunCommand(['--workspace', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await runRunCommand(['--workspace', inputValue1, '--workspace', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somedirectory', './anotherdirectory'];
			const inputValue2 = ['./someotherdirectory', './yetanotherdirectory'];
			await runRunCommand(['--workspace', inputValue1.join(','), '--workspace', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [...inputValue1, ...inputValue2]);
		});

		it('Defaults to value of "."', async () => {
			await runRunCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', ['.']);
		});

		it('Can be referenced by its shortname, -w', async () => {
			const inputValue = './somedirectory';
			await runRunCommand(['-w', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('workspace', [inputValue]);
		});
	});

	describe('--target', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.cls';
			await runRunCommand(['--target', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somefile.cls', './someotherfile.cls'];
			await runRunCommand(['--target', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somefile.cls';
			const inputValue2 = './someotherfile.cls';
			await runRunCommand(['--target', inputValue1, '--target', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somefile.cls', './anotherfile.cls'];
			const inputValue2 = ['./someotherfile.cls', './yetanotherfile.cls'];
			await runRunCommand(['--target', inputValue1.join(','), '--target', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [...inputValue1, ...inputValue2]);
		});

		it('Can be referenced by its shortname, -t', async () => {
			const inputValue = './somefile.cls';
			await runRunCommand(['-t', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('target', [inputValue]);
		});
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await runRunCommand(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['abcde', 'defgh'];
			await runRunCommand(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await runRunCommand(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['a,(bc):de', 'hijlk'];
			const inputValue2 = ['defgh', 'mnopq'];
			await runRunCommand(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ['a,(bc):de', 'hijlk', 'defgh' ,'mnopq']);
		});

		it('Defaults to value of "Recommended"', async () => {
			await runRunCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["Recommended"]);
		});

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await runRunCommand(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--severity-threshold', () => {
		it.each([
			{sev: '1', exp: 1}, {sev: '2', exp: 2}, {sev: '3', exp: 3}, {sev: '4', exp: 4}, {sev: '5', exp: 5},
			{sev: 'criticAL', exp: 1}, {sev: 'High', exp: 2}, {sev: 'moderate', exp: 3}, {sev: 'low', exp: 4} , {sev: 'info', exp: 5}
		])('Accepts valid severity value: $sev', async ({sev, exp}) => {
			await runRunCommand(['--severity-threshold', sev]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('severity-threshold', exp);
		});

		it.each([
			{invalidSev: '0', reason: 'it is integer < 1'},
			{invalidSev: '7', reason: 'it is integer > 5'},
			{invalidSev: 'beep', reason: 'it is not a valid severity string'}
		])('Rejects invalid severity $invalidSev because $reason', async ({invalidSev}) => {
			const executionPromise = runRunCommand(['--severity-threshold', invalidSev]);
			await expect(executionPromise).rejects.toThrow(`Expected --severity-threshold=${invalidSev} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'critical';
			const inputValue2 = 'high';
			const executionPromise = runRunCommand(['--severity-threshold', inputValue1, '--severity-threshold', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --severity-threshold can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await runRunCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput['severity-threshold']).toBeUndefined();
		});

		it('Can be referenced by its shortname, -s', async () => {
			const inputValue = `3`
			await runRunCommand(['-s', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('severity-threshold', parseInt(inputValue));
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await runRunCommand(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = runRunCommand(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = runRunCommand(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await runRunCommand(['-c', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});
	});

	describe('--output-file', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.json';
			await runRunCommand(['--output-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somefile.json', './someotherfile.xml'];
			await runRunCommand(['--output-file', inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual(inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somefile.json';
			const inputValue2 = './someotherfile.xml';
			await runRunCommand(['--output-file', inputValue1, '--output-file', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple comma-separated values', async () => {
			const inputValue1 = ['./somefile.json', './someotherfile.xml'];
			const inputValue2 = ['./athirdfile.csv', './afourthfile.json'];
			await runRunCommand(['--output-file', inputValue1.join(','), '--output-file', inputValue2.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([...inputValue1, ...inputValue2]);
		});

		it('Can be referenced by its shortname, -f', async () => {
			const inputValue = './somefile.json';
			await runRunCommand(['-f', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFilesSpy).toHaveBeenCalled();
			expect(receivedFiles).toEqual([inputValue]);
		});
	});

	describe('--view', () => {
		it('Accepts the value, "table"', async () => {
			const inputValue = 'table';
			await runRunCommand(['--view', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsTableDisplayer');
		});

		it('Accepts the value, "detail"', async () => {
			const inputValue = 'detail';
			await runRunCommand(['--view', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
		});

		it('Rejects all other values', async () => {
			const inputValue = 'beep';
			const executionPromise = runRunCommand(['--view', inputValue]);
			await expect(executionPromise).rejects.toThrow(`Expected --view=${inputValue} to be one of:`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be supplied only once', async () => {
			const inputValue1 = 'detail';
			const inputValue2 = 'table';
			const executionPromise = runRunCommand(['--view', inputValue1, '--view', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --view can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -v', async () => {
			// Use a non-default value, so we know that the flag's value comes from our input and not the default.
			const inputValue = 'detail';
			await runRunCommand(['-v', inputValue]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
		});
	});

	describe('Telemetry emission', () => {
		it('Passes telemetry emitter through into Action layer', async () => {
			await runRunCommand([]);
			expect(createActionSpy).toHaveBeenCalled();
			expect(receivedActionDependencies.telemetryEmitter!.constructor.name).toEqual('SfCliTelemetryEmitter');
		});
	});

	describe('Flag interactions', () => {
		describe('--output-file and --view', () => {
			it('When --output-file and --view are both present, both are used', async () => {
				const outfileInput = 'beep.json';
				const viewInput = 'detail';
				await runRunCommand(['--output-file', outfileInput, '--view', viewInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsDetailDisplayer');
			});

			it('When --output-file is present and --view is not, --view is a no-op', async () => {
				const outfileInput= 'beep.json';
				await runRunCommand(['--output-file', outfileInput]);
				expect(executeSpy).toHaveBeenCalled();
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([outfileInput]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsNoOpDisplayer');
			});

			it('When --output-file and --view are both absent, --view defaults to "table"', async () => {
				await runRunCommand([]);
				expect(createActionSpy).toHaveBeenCalled();
				expect(fromFilesSpy).toHaveBeenCalled();
				expect(receivedFiles).toEqual([]);
				expect(receivedActionDependencies.resultsViewer.constructor.name).toEqual('ResultsTableDisplayer');
			});
		});
	});
});

