import * as path from 'node:path';
import {CodeAnalyzerConfig, CodeAnalyzer, Workspace} from '@salesforce/code-analyzer-core';
import * as WorkspaceUtil from '../../../src/lib/utils/WorkspaceUtil.js';


describe('WorkspaceUtil', () => {
	describe('#createWorkspace()' ,() => {
		const ORIGINAL_TEST_DIR = process.cwd();
		const PATH_TO_WORKSPACE = path.join(import.meta.dirname, '..', '..', 'fixtures', 'example-workspaces', 'workspace-with-dotted-items');

		beforeEach(() => {
			process.chdir(PATH_TO_WORKSPACE)
		});

		afterEach(() => {
			process.chdir(ORIGINAL_TEST_DIR);
		});

		describe('File/Folder matching', () => {
			it.each([
				{scenario: 'a single relative file', expectation: 'just that file', input: ['undotted-file-1.txt']},
				{
					scenario: 'a list of relative files',
					expectation: 'just those files',
					input: [path.join('.', 'undotted-directory-a', 'undotted-file-2a.txt'), '.dotted-file-2.txt']
				},
				{
					scenario: 'a single relative folder',
					expectation: 'just that folder',
					input: ['undotted-directory-a']
				},
				{
					scenario: 'a list of folders',
					expectation: 'just those folders',
					input: ['undotted-directory-a', '.dotted-directory-b']
				},
				{
					scenario: 'mixed relative folders and files',
					expectation: 'just those files/folders',
					input: ['.dotted-file-1.txt', path.join('.', 'undotted-directory-b')]
				},
				{
					scenario: 'a single absolute file',
					expectation: 'just that file',
					input: [path.join(PATH_TO_WORKSPACE, 'undotted-file-1.txt')]
				},
				{
					scenario: 'a list of absolute files',
					expectation: 'just those files',
					input: [
						path.join(PATH_TO_WORKSPACE, 'undotted-directory-a', 'undotted-file-2a.txt'),
						path.join(PATH_TO_WORKSPACE, '.dotted-file-2.txt')
					]
				},
				{
					scenario: 'a single absolute folder',
					expectation: 'just that folder',
					input: ['undotted-directory-a']
				},
				{
					scenario: 'a list of absolute folders',
					expectation: 'just those folders',
					input: [
						path.join(PATH_TO_WORKSPACE, 'undotted-directory-a'),
						path.join(PATH_TO_WORKSPACE, '.dotted-directory-b')
					]
				},
				{
					scenario: 'mixed absolute folders and files',
					expectation: 'just those files/folders',
					input: [
						path.join(PATH_TO_WORKSPACE, '.dotted-file-1.txt'),
						path.join(PATH_TO_WORKSPACE, 'undotted-directory-b')
					]
				}
			])('Given $scenario, requests a workspace with $expectation', async ({input}) => {
				// ==== TEST SETUP ====
				const config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
				const core: CodeAnalyzer = new CodeAnalyzer(config);

				// ==== TESTED BEHAVIOR ====
				const workspace: Workspace = await WorkspaceUtil.createWorkspace(core, input);

				// ==== ASSERTIONS ====
				const workspaceItems: string[] = workspace.getRawFilesAndFolders();
				const expectedWorkspaceSet = new Set(input.map(i => path.resolve('.', i)));
				expect(workspaceItems).toHaveLength(expectedWorkspaceSet.size);
				for (const expectedWorkspaceItem of expectedWorkspaceSet.keys()) {
					expect(workspaceItems).toContain(expectedWorkspaceItem);
				}
			});
		});

		describe('Glob matching', () => {
			it.each([
				{
					scenario: 'a single relative file',
					expectation: 'just that file',
					input: path.join('.', 'undotted*1.txt'),
					output: new Set([path.resolve(PATH_TO_WORKSPACE, 'undotted-file-1.txt')])
				},
				{
					scenario: 'a list of relative files',
					expectation: 'just those files',
					input: path.join('.', 'undotted*'),
					output: new Set([
						path.resolve(PATH_TO_WORKSPACE, 'undotted-file-1.txt'),
						path.resolve(PATH_TO_WORKSPACE, 'undotted-file-2.txt')
					])
				},
				{
					scenario: 'a single absolute file',
					expectation: 'just that file',
					input: path.resolve(PATH_TO_WORKSPACE, 'undotted*1.txt'),
					output: new Set([path.resolve(PATH_TO_WORKSPACE, 'undotted-file-1.txt')])
				},
				{
					scenario: 'a list of absolute files',
					expectation: 'just those files',
					input: path.resolve(PATH_TO_WORKSPACE, 'undotted*'),
					output: new Set([
						path.resolve(PATH_TO_WORKSPACE, 'undotted-file-1.txt'),
						path.resolve(PATH_TO_WORKSPACE, 'undotted-file-2.txt')
					])
				}
			])('Given a glob that matches $scenario, requests a workspace with $expectation', async ({
																										 input,
																										 output
																									 }) => {
				// ==== TEST SETUP ====
				const config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
				const core: CodeAnalyzer = new CodeAnalyzer(config);

				// ==== TESTED BEHAVIOR ====
				const workspace: Workspace = await WorkspaceUtil.createWorkspace(core, [input]);

				// ==== ASSERTIONS ====
				const actualWorkspacePaths: string[] = workspace.getRawFilesAndFolders();
				expect(actualWorkspacePaths).toHaveLength(output.size);
				for (const expectedWorkspacePath of output.keys()) {
					expect(actualWorkspacePaths).toContain(expectedWorkspacePath);
				}
			});

			describe('Dotted file/folder handling', () => {
				it.each([
					{
						scenario: 'the current directory',
						glob: path.join('.', '.*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, '.dotted-file-1.txt'),
							path.resolve(PATH_TO_WORKSPACE, '.dotted-file-2.txt')
						])
					},
					{
						scenario: 'dotted subfolders of the current directory',
						glob: path.join('.', '.*', '.*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, '.dotted-directory-a', '.dotted-file-1a.txt'),
							path.resolve(PATH_TO_WORKSPACE, '.dotted-directory-b', '.dotted-file-1b.txt')
						])
					},
					{
						scenario: 'undotted subfolders of the current directory',
						glob: path.join('.', '*', '.*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, 'undotted-directory-a', '.dotted-file-2a.txt'),
							path.resolve(PATH_TO_WORKSPACE, 'undotted-directory-b', '.dotted-file-2b.txt')
						])
					}
				])('A glob explicitly seeking dotted files in $scenario will find them', async ({
																									glob,
																									expectation
																								}) => {
					// ==== TEST SETUP ====
					const config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
					const core: CodeAnalyzer = new CodeAnalyzer(config);

					// ==== TESTED BEHAVIOR ====
					const workspace: Workspace = await WorkspaceUtil.createWorkspace(core, [glob]);

					// ==== ASSERTIONS ====
					const workspaceFiles: string[] = workspace.getRawFilesAndFolders();
					expect(workspaceFiles).toHaveLength(expectation.size);
					for (const expectedWorkspacePath of expectation.keys()) {
						expect(workspaceFiles).toContain(expectedWorkspacePath);
					}
				});

				it.each([
					{
						scenario: 'the current directory',
						glob: path.join('.', '*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, 'undotted-file-1.txt'),
							path.resolve(PATH_TO_WORKSPACE, 'undotted-file-2.txt')
						])
					},
					{
						scenario: 'dotted subfolders of the current directory',
						glob: path.join('.', '.**', '*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, '.dotted-directory-a', 'undotted-file-1a.txt'),
							path.resolve(PATH_TO_WORKSPACE, '.dotted-directory-b', 'undotted-file-1b.txt')
						])
					},
					{
						scenario: 'undotted subfolders of the current directory',
						glob: path.join('.', '*', '*'),
						expectation: new Set([
							path.resolve(PATH_TO_WORKSPACE, 'undotted-directory-a', 'undotted-file-2a.txt'),
							path.resolve(PATH_TO_WORKSPACE, 'undotted-directory-b', 'undotted-file-2b.txt')
						])
					}
				])('A glob NOT explicitly seeking dotted items in $scenario will find only undotted items', async ({
																													   glob,
																													   expectation
																												   }) => {
					// ==== TEST SETUP ====
					const config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
					const core: CodeAnalyzer = new CodeAnalyzer(config);

					// ==== TESTED BEHAVIOR ====
					const workspace: Workspace = await WorkspaceUtil.createWorkspace(core, [glob]);

					// ==== ASSERTIONS ====
					const workspaceFiles: string[] = workspace.getRawFilesAndFolders();
					expect(workspaceFiles).toHaveLength(expectation.size);
					for (const expectedWorkspacePath of expectation.keys()) {
						expect(workspaceFiles).toContain(expectedWorkspacePath);
					}
				});
			});

			it('Negative globs are unsupported', async () => {
				const config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
				const core: CodeAnalyzer = new CodeAnalyzer(config);
				const input = path.join('!', '.', 'undotted-file-1.txt');

				// Typically we'd use Jest's `expect().toThrow()` method, but since we need to assert specific things about
				// the error, we're doing this instead.
				let thrownError: Error | null = null;
				try {
					await WorkspaceUtil.createWorkspace(core, [input]);
				} catch (e) {
					thrownError = e;
				}
				expect(thrownError).toBeInstanceOf(Error);
				// Expect the error message to mention globs in some capacity.
				expect((thrownError as Error).message).toContain('glob');
			});
		});
	});
});
