import * as path from 'node:path';
import {OutputFormat} from '@salesforce/code-analyzer-core';
import {CompositeRulesWriter, RulesFileWriter} from "../../../src/lib/writers/RulesWriter.js";
import * as Stub from '../../stubs/StubRuleSelection.js';
import { StubFileSystem } from '../../stubs/StubFileSystem.js';

describe('RulesWriter', () => {

	let fileSystem: StubFileSystem;
	beforeEach(() => {
		fileSystem = new StubFileSystem();
	});

	describe('RulesFileWriter', () => {

		it('Rejects invalid file format', () => {
			const invalidFile = 'file.xml';
			expect(() => new RulesFileWriter(invalidFile)).toThrow(invalidFile);
		});

		it.each([
			{ext: 'json', format: OutputFormat.JSON},
			{ext: 'csv', format: OutputFormat.CSV}
		])('Writes to a $ext file path', ({ext, format}) => {
			const outfilePath = path.join('the', 'results', 'path', `file.${ext}`);
			const rulesWriter = new RulesFileWriter(outfilePath, fileSystem);
			const stubbedSelection = new Stub.StubEmptyRuleSelection();
			rulesWriter.write(stubbedSelection);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(1);
			expect(fileSystem.writeFileSyncCallHistory[0]).toEqual({
				file: outfilePath,
				contents: `Rules formatted as ${format}`
			});
		});
	});

	describe('CompositeRulesWriter', () => {

		it('Does a no-op when there are no files to write to', () => {
			const outputFileWriter = CompositeRulesWriter.fromFiles([], fileSystem);
			const stubbedEmptyRuleSelection = new Stub.StubEmptyRuleSelection();

			outputFileWriter.write(stubbedEmptyRuleSelection);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(0);
		});

		it('When given multiple files, outputs to all of them', () => {
			const expectations = [{
				file: 'outFile1.json',
				contents: `Rules formatted as ${OutputFormat.JSON}`
			}, {
				file: 'outFile2.json',
				contents: `Rules formatted as ${OutputFormat.JSON}`
			}];
			const outputFileWriter = CompositeRulesWriter.fromFiles(expectations.map(i => i.file), fileSystem);
			const stubbedSelection = new Stub.StubEmptyRuleSelection();

			outputFileWriter.write(stubbedSelection);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(2);
			expect(fileSystem.writeFileSyncCallHistory).toEqual(expectations);
		});
	})
});
