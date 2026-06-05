import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {AstDumpAction, AstDumpInput, AstDumpOutput, AstDumpJsonOutput, AstDumpXmlOutput, AstDumpErrorOutput} from '../../../src/lib/actions/AstDumpAction.js';

const { mockGenerateAst } = vi.hoisted(() => {
	return { mockGenerateAst: vi.fn() };
});

vi.mock('@salesforce/code-analyzer-pmd-engine', () => {
	return {
		PmdEngine: class MockPmdEngine {
			generateAst = mockGenerateAst;
		}
	};
});

const SAMPLE_AST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CompilationUnit Image="">
  <TypeDeclaration Image="">
    <ClassDeclaration Image="MyClass" SimpleName="MyClass">
      <MethodDeclaration Image="myMethod" Name="myMethod"/>
    </ClassDeclaration>
  </TypeDeclaration>
</CompilationUnit>`;

const PATH_TO_SAMPLE_CODE = path.resolve('test', 'sample-code');
const PATH_TO_FILE_A = path.resolve(PATH_TO_SAMPLE_CODE, 'fileA.cls');

describe('AstDumpAction tests', () => {
	let action: AstDumpAction;

	beforeEach(() => {
		mockGenerateAst.mockReset();
		action = AstDumpAction.createAction();
	});

	describe('File validation', () => {
		it('Returns error when file does not exist', async () => {
			const input: AstDumpInput = {
				file: '/nonexistent/path/file.cls',
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpErrorOutput;

			expect(output.status).toBe('error');
			expect(output.message).toContain('File not found');
		});

		it('Returns error when path is a directory', async () => {
			const input: AstDumpInput = {
				file: PATH_TO_SAMPLE_CODE,
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpErrorOutput;

			expect(output.status).toBe('error');
			expect(output.message).toContain('not a regular file');
		});

		it('Returns error when file exceeds max size', async () => {
			const tmpFile = path.join(os.tmpdir(), 'ast-dump-test-large-file.cls');
			fs.writeFileSync(tmpFile, 'x'.repeat(1_000_001));
			try {
				const input: AstDumpInput = {
					file: tmpFile,
					language: 'apex',
					format: 'xml'
				};

				const output = await action.execute(input) as AstDumpErrorOutput;

				expect(output.status).toBe('error');
				expect(output.message).toContain('exceeds maximum size');
			} finally {
				fs.unlinkSync(tmpFile);
			}
		});
	});

	describe('Language detection', () => {
		it('Detects apex from .cls extension', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpXmlOutput;

			expect(output.status).toBe('success');
			expect(output.language).toBe('apex');
			expect(mockGenerateAst).toHaveBeenCalledWith('apex', expect.any(String), expect.any(Object));
		});

		it('Uses explicitly provided language over auto-detection', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'visualforce',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpXmlOutput;

			expect(output.status).toBe('success');
			expect(output.language).toBe('visualforce');
			expect(mockGenerateAst).toHaveBeenCalledWith('visualforce', expect.any(String), expect.any(Object));
		});

		it('Returns error for unsupported file extension when no language specified', async () => {
			const tmpFile = path.join(os.tmpdir(), 'ast-dump-test-file.py');
			fs.writeFileSync(tmpFile, 'print("hello")');
			try {
				const input: AstDumpInput = {
					file: tmpFile,
					format: 'xml'
				};

				const output = await action.execute(input) as AstDumpErrorOutput;

				expect(output.status).toBe('error');
				expect(output.message).toContain('Unable to determine language');
			} finally {
				fs.unlinkSync(tmpFile);
			}
		});
	});

	describe('XML format output', () => {
		it('Returns raw AST XML on success', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpXmlOutput;

			expect(output.status).toBe('success');
			expect(output.ast).toBe(SAMPLE_AST_XML);
			expect(output.file).toBe(path.resolve(PATH_TO_FILE_A));
			expect(output.language).toBe('apex');
		});
	});

	describe('JSON format output', () => {
		it('Parses AST XML into nodes with ancestry', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'apex',
				format: 'json'
			};

			const output = await action.execute(input) as AstDumpJsonOutput;

			expect(output.status).toBe('success');
			expect(output.totalNodes).toBeGreaterThan(0);
			expect(output.nodes).toBeInstanceOf(Array);

			const compilationUnit = output.nodes.find(n => n.nodeName === 'CompilationUnit');
			expect(compilationUnit).toBeDefined();
			expect(compilationUnit!.parent).toBeNull();
			expect(compilationUnit!.ancestors).toEqual([]);

			const classDecl = output.nodes.find(n => n.nodeName === 'ClassDeclaration');
			expect(classDecl).toBeDefined();
			expect(classDecl!.attributes['SimpleName']).toBe('MyClass');
			expect(classDecl!.ancestors).toContain('CompilationUnit');

			const methodDecl = output.nodes.find(n => n.nodeName === 'MethodDeclaration');
			expect(methodDecl).toBeDefined();
			expect(methodDecl!.parent).toBe('ClassDeclaration');
			expect(methodDecl!.attributes['Name']).toBe('myMethod');
		});
	});

	describe('Output file writing', () => {
		it('Writes XML output to file', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});
			const outputFile = path.join(os.tmpdir(), 'ast-dump-test-output.xml');

			try {
				const input: AstDumpInput = {
					file: PATH_TO_FILE_A,
					language: 'apex',
					format: 'xml',
					'output-file': outputFile
				};

				const output = await action.execute(input) as AstDumpXmlOutput;

				expect(output.status).toBe('success');
				const written = fs.readFileSync(outputFile, 'utf-8');
				expect(written).toBe(SAMPLE_AST_XML);
			} finally {
				if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
			}
		});

		it('Writes JSON output to file', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: SAMPLE_AST_XML, error: null});
			const outputFile = path.join(os.tmpdir(), 'ast-dump-test-output.json');

			try {
				const input: AstDumpInput = {
					file: PATH_TO_FILE_A,
					language: 'apex',
					format: 'json',
					'output-file': outputFile
				};

				const output = await action.execute(input) as AstDumpJsonOutput;

				expect(output.status).toBe('success');
				const written = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
				expect(written.nodes).toBeInstanceOf(Array);
				expect(written.totalNodes).toBe(output.totalNodes);
			} finally {
				if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
			}
		});
	});

	describe('Error handling', () => {
		it('Returns error when PmdEngine throws', async () => {
			mockGenerateAst.mockRejectedValue(new Error('Java not found'));

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpErrorOutput;

			expect(output.status).toBe('error');
			expect(output.message).toContain('Failed to parse AST');
			expect(output.message).toContain('Java not found');
		});

		it('Returns error when results contain an error', async () => {
			mockGenerateAst.mockResolvedValue({
				file: PATH_TO_FILE_A,
				ast: null,
				error: {message: 'Parse error at line 5'}
			});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpErrorOutput;

			expect(output.status).toBe('error');
			expect(output.message).toContain('Parse error at line 5');
		});

		it('Returns error when AST is null without error', async () => {
			mockGenerateAst.mockResolvedValue({file: PATH_TO_FILE_A, ast: null, error: null});

			const input: AstDumpInput = {
				file: PATH_TO_FILE_A,
				language: 'apex',
				format: 'xml'
			};

			const output = await action.execute(input) as AstDumpErrorOutput;

			expect(output.status).toBe('error');
			expect(output.message).toContain('No AST generated');
		});
	});

	describe('createAction', () => {
		it('Creates an instance of AstDumpAction', () => {
			const instance = AstDumpAction.createAction();
			expect(instance).toBeInstanceOf(AstDumpAction);
		});
	});
});
