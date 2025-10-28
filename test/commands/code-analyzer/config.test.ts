import * as path from 'node:path';
import {Config, settings} from '@oclif/core';
import ConfigCommand from '../../../src/commands/code-analyzer/config.js';
import {ConfigAction, ConfigInput} from '../../../src/lib/actions/ConfigAction.js';
import {ConfigFileWriter} from '../../../src/lib/writers/ConfigWriter.js';
import {SpyDisplay} from '../../stubs/SpyDisplay.js';
import {ConsoleOuputInterceptor} from '../../test-utils.js';

const rootFolderWithPackageJson: string = path.join(__dirname, '..', '..', '..');

/* 
We need to set the oclif settings to have enableAutoTranspile=false.
This because vitest has its own typescript interpreter which doesn't work with oclif's use of dynamic imports of
typescript files. Setting this to false seems to resolve this so that we do not get warnings that look like:
	(node:39148) [ERR_UNKNOWN_FILE_EXTENSION] Warning: TypeError
	module: @oclif/core@3.27.0
	task: findCommand (code-analyzer:config)
	plugin: @salesforce/plugin-code-analyzer
	root: /tmp/github/forcedotcom/code-analyzer
	code: ERR_UNKNOWN_FILE_EXTENSION
	message: Unknown file extension ".ts" for /tmp/github/forcedotcom/code-analyzer/src/commands/code-analyzer/config.ts
*/
settings.enableAutoTranspile = false;
const config: Config = new Config({ root: rootFolderWithPackageJson });

async function runConfigCommand(userArgs: string[]): Promise<void> {
	const command: ConfigCommand = new ConfigCommand(userArgs, config);
	return await command.run();
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
			await runConfigCommand([]);
		} finally {
			outputInterceptor.stop();
		}
		expect(outputInterceptor.out).toContain('CODE ANALYZER CONFIGURATION');
		expect(outputInterceptor.out).toContain('END OF CODE ANALYZER CONFIGURATION');
	});
});

describe('`code-analyzer config` unit tests', () => {
	beforeAll(async () => {
		await config.load();
	});

	let executeSpy: ReturnType<typeof vi.spyOn>;
	let createActionSpy: ReturnType<typeof vi.spyOn>;
	let receivedActionInput!: ConfigInput;

	beforeEach(() => {
		executeSpy = vi.spyOn(ConfigAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve();
		});
		const originalCreateAction = ConfigAction.createAction;
		createActionSpy = vi.spyOn(ConfigAction, 'createAction').mockImplementation((dependencies) => {
			return originalCreateAction(dependencies);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('--rule-selector', () => {
		it('Can be supplied once with a single value', async () => {
			const inputValue = 'abcde';
			await runConfigCommand(['--rule-selector', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});

		it('Can be supplied once with multiple space-separated values', async () => {
			const inputValue = ['abc,(asdf:eee):de', 'de:fgh'];
			await runConfigCommand(['--rule-selector', inputValue.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = 'abcde';
			const inputValue2 = 'defgh';
			await runConfigCommand(['--rule-selector', inputValue1, '--rule-selector', inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue1, inputValue2]);
		});

		it('Can be supplied multiple times with multiple space-separated values each', async () => {
			const inputValue1 = ['ab,(qq:zz),cde', 'hijlk'];
			const inputValue2 = ['defgh', 'mnopq'];
			await runConfigCommand(['--rule-selector', inputValue1.join(' '), '--rule-selector', inputValue2.join(' ')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ['ab,(qq:zz),cde', 'hijlk',  'defgh', 'mnopq']);
		});

		it('Defaults to value of "all"', async () => {
			await runConfigCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', ["all"]);
		})

		it('Can be referenced by its shortname, -r', async () => {
			const inputValue = 'abcde';
			await runConfigCommand(['-r', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('rule-selector', [inputValue]);
		});
	});

	describe('--config-file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await runConfigCommand(['--config-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('config-file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.json';
			const executionPromise = runConfigCommand(['--config-file', inputValue]);
			await expect(executionPromise).rejects.toThrow(`No file found at ${inputValue}`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await runConfigCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput['config-file']).toBeUndefined();
		});

		it('Can only be supplied once', async () => {
			const inputValue1 = 'package.json';
			const inputValue2 = 'LICENSE';
			const executionPromise = runConfigCommand(['--config-file', inputValue1, '--config-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --config-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Can be referenced by its shortname, -c', async () => {
			const inputValue = 'package.json';
			await runConfigCommand(['-c', inputValue]);
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
			await runConfigCommand([flag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});

		it('Can be supplied once with multiple comma-separated values', async () => {
			const inputValue =['./somedirectory', './someotherdirectory'];
			await runConfigCommand([flag, inputValue.join(',')]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, inputValue);
		});

		it('Can be supplied multiple times with one value each', async () => {
			const inputValue1 = './somedirectory';
			const inputValue2 = './someotherdirectory';
			await runConfigCommand([flag, inputValue1, flag, inputValue2]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue1, inputValue2]);
		});

		it('Is unused if not directly specified', async () => {
			await runConfigCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput[property]).toBeUndefined();
		});

		it(`Can be referenced by its shortname, ${shortflag}`, async () => {
			const inputValue = './somedirectory';
			await runConfigCommand([shortflag, inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty(property, [inputValue]);
		});
	});

	describe('--output-file', () => {

		let fromFileSpy: ReturnType<typeof vi.spyOn>;
		let receivedFile: string|null;

		beforeEach(() => {
			const originalFromFile = ConfigFileWriter.fromFile;
			fromFileSpy = vi.spyOn(ConfigFileWriter, 'fromFile').mockImplementation(file => {
				receivedFile = file;
				return originalFromFile(file, new SpyDisplay());
			});
		});


		it('Can be supplied once with a single value', async () => {
			const inputValue = './somefile.yml';
			await runConfigCommand(['--output-file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).toHaveBeenCalled();
			expect(receivedFile).toEqual(inputValue);
			expect(receivedActionInput).toHaveProperty('output-file', inputValue);
		});

		it('Can be referenced by its shortname, -f', async () => {
			const inputValue = './somefile.yml';
			await runConfigCommand(['-f', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).toHaveBeenCalled();
			expect(receivedFile).toEqual(inputValue);
			expect(receivedActionInput).toHaveProperty('output-file', inputValue);
		});

		it('Cannot be supplied multiple times', async () => {
			const inputValue1 = './somefile.yml';
			const inputValue2 = './someotherfile.yml';
			const executionPromise = runConfigCommand(['--output-file', inputValue1, '--output-file', inputValue2]);
			await expect(executionPromise).rejects.toThrow(`Flag --output-file can only be specified once`);
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is unused if not directly specified', async () => {
			await runConfigCommand([]);
			expect(executeSpy).toHaveBeenCalled();
			expect(createActionSpy).toHaveBeenCalled();
			expect(fromFileSpy).not.toHaveBeenCalled();
			expect(receivedActionInput['output-file']).toBeUndefined();
		});
	});
});
