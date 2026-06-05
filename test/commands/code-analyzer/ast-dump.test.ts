import * as path from 'node:path';
import {Config, settings} from '@oclif/core';
import AstDumpCommand from '../../../src/commands/code-analyzer/ast-dump.js';
import {AstDumpAction, AstDumpInput} from '../../../src/lib/actions/AstDumpAction.js';
import {ConsoleOuputInterceptor} from '../../test-utils.js';

const rootFolderWithPackageJson: string = path.join(__dirname, '..', '..', '..');

settings.enableAutoTranspile = false;
const config: Config = new Config({root: rootFolderWithPackageJson});

async function runAstDumpCommand(userArgs: string[]): Promise<void> {
	const command: AstDumpCommand = new AstDumpCommand(userArgs, config);
	return await command.run();
}

describe('`code-analyzer ast-dump` unit tests', () => {
	beforeAll(async () => {
		await config.load();
	});

	let executeSpy: ReturnType<typeof vi.spyOn>;
	let createActionSpy: ReturnType<typeof vi.spyOn>;
	let receivedActionInput!: AstDumpInput;

	beforeEach(() => {
		executeSpy = vi.spyOn(AstDumpAction.prototype, 'execute').mockImplementation((input) => {
			receivedActionInput = input;
			return Promise.resolve({status: 'success', file: input.file, language: 'apex', ast: '<xml/>'});
		});
		createActionSpy = vi.spyOn(AstDumpAction, 'createAction').mockImplementation(() => {
			return new AstDumpAction();
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('--file', () => {
		it('Accepts a real file', async () => {
			const inputValue = 'package.json';
			await runAstDumpCommand(['--file', inputValue]);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('file', inputValue);
		});

		it('Rejects non-existent file', async () => {
			const inputValue = 'definitelyFakeFile.cls';
			const executionPromise = runAstDumpCommand(['--file', inputValue]);
			await expect(executionPromise).rejects.toThrow();
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Is required', async () => {
			const executionPromise = runAstDumpCommand([]);
			await expect(executionPromise).rejects.toThrow();
			expect(executeSpy).not.toHaveBeenCalled();
		});
	});

	describe('--language', () => {
		it('Accepts valid language value', async () => {
			await runAstDumpCommand(['--file', 'package.json', '--language', 'apex']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('language', 'apex');
		});

		it('Accepts all supported languages', async () => {
			for (const lang of ['apex', 'visualforce', 'html', 'xml', 'javascript']) {
				vi.restoreAllMocks();
				executeSpy = vi.spyOn(AstDumpAction.prototype, 'execute').mockImplementation((input) => {
					receivedActionInput = input;
					return Promise.resolve({status: 'success', file: input.file, language: lang, ast: '<xml/>'});
				});
				createActionSpy = vi.spyOn(AstDumpAction, 'createAction').mockImplementation(() => new AstDumpAction());

				await runAstDumpCommand(['--file', 'package.json', '--language', lang]);
				expect(receivedActionInput).toHaveProperty('language', lang);
			}
		});

		it('Rejects invalid language value', async () => {
			const executionPromise = runAstDumpCommand(['--file', 'package.json', '--language', 'python']);
			await expect(executionPromise).rejects.toThrow();
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Defaults to apex', async () => {
			await runAstDumpCommand(['--file', 'package.json']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('language', 'apex');
		});

		it('Can be referenced by shortname -l', async () => {
			await runAstDumpCommand(['--file', 'package.json', '-l', 'html']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('language', 'html');
		});
	});

	describe('--format', () => {
		it('Accepts xml format', async () => {
			await runAstDumpCommand(['--file', 'package.json', '--format', 'xml']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('format', 'xml');
		});

		it('Accepts json format', async () => {
			executeSpy.mockImplementation((input) => {
				receivedActionInput = input;
				return Promise.resolve({status: 'success', file: input.file, language: 'apex', totalNodes: 0, nodes: []});
			});
			await runAstDumpCommand(['--file', 'package.json', '--format', 'json']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('format', 'json');
		});

		it('Rejects invalid format', async () => {
			const executionPromise = runAstDumpCommand(['--file', 'package.json', '--format', 'csv']);
			await expect(executionPromise).rejects.toThrow();
			expect(executeSpy).not.toHaveBeenCalled();
		});

		it('Defaults to xml', async () => {
			await runAstDumpCommand(['--file', 'package.json']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('format', 'xml');
		});
	});

	describe('--output-file', () => {
		it('Can be supplied with a value', async () => {
			await runAstDumpCommand(['--file', 'package.json', '--output-file', './out.xml']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput).toHaveProperty('output-file', './out.xml');
		});

		it('Is unused if not specified', async () => {
			await runAstDumpCommand(['--file', 'package.json']);
			expect(executeSpy).toHaveBeenCalled();
			expect(receivedActionInput['output-file']).toBeUndefined();
		});
	});

	describe('Output display', () => {
		it('Logs XML output directly when format is xml', async () => {
			const astXml = '<CompilationUnit/>';
			executeSpy.mockImplementation((input) => {
				receivedActionInput = input;
				return Promise.resolve({status: 'success', file: input.file, language: 'apex', ast: astXml});
			});

			const outputInterceptor = new ConsoleOuputInterceptor();
			try {
				outputInterceptor.start();
				await runAstDumpCommand(['--file', 'package.json', '--format', 'xml']);
			} finally {
				outputInterceptor.stop();
			}
			expect(outputInterceptor.out).toContain(astXml);
		});

		it('Logs JSON output when format is json', async () => {
			executeSpy.mockImplementation((input) => {
				receivedActionInput = input;
				return Promise.resolve({status: 'success', file: input.file, language: 'apex', totalNodes: 1, nodes: [{nodeName: 'Root', attributes: {}, parent: null, ancestors: []}]});
			});

			const outputInterceptor = new ConsoleOuputInterceptor();
			try {
				outputInterceptor.start();
				await runAstDumpCommand(['--file', 'package.json', '--format', 'json']);
			} finally {
				outputInterceptor.stop();
			}
			expect(outputInterceptor.out).toContain('"nodeName"');
			expect(outputInterceptor.out).toContain('"Root"');
		});

		it('Logs file path message when output-file is specified', async () => {
			const outputInterceptor = new ConsoleOuputInterceptor();
			try {
				outputInterceptor.start();
				await runAstDumpCommand(['--file', 'package.json', '--output-file', './my-output.xml']);
			} finally {
				outputInterceptor.stop();
			}
			expect(outputInterceptor.out).toContain('AST written to: ./my-output.xml');
		});

		it('Throws error when action returns error status', async () => {
			executeSpy.mockImplementation(() => {
				return Promise.resolve({status: 'error', message: 'Something went wrong'});
			});

			const executionPromise = runAstDumpCommand(['--file', 'package.json']);
			await expect(executionPromise).rejects.toThrow('Something went wrong');
		});
	});
});
