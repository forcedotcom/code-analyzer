import { OutputFormat } from '@salesforce/code-analyzer-core';
import fs from 'node:fs';
import path from 'node:path';
import { CompositeRulesWriter, RulesFileWriter } from "../../../src/lib/writers/RulesWriter";
import * as Stub from '../../stubs/StubRuleSelection';

describe('RulesWriter', () => {

	let writeFileSpy: jest.SpyInstance;
	let writeFileInvocations: { file: fs.PathOrFileDescriptor, contents: string | ArrayBufferView }[];

	beforeEach(() => {
		jest.resetAllMocks();
		writeFileInvocations = [];
		writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((file, contents) => {
			writeFileInvocations.push({file, contents});
		});
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
			const expectations = {
				file: outfilePath,
				contents: `Rules formatted as ${format}`
			};
			const rulesWriter = new RulesFileWriter(expectations.file);
			const stubbedSelection = new Stub.StubEmptyRuleSelection();
			rulesWriter.write(stubbedSelection);

			expect(writeFileSpy).toHaveBeenCalled();
			expect(writeFileInvocations).toEqual([expectations]);
		});
	});

	describe('CompositeRulesWriter', () => {

		it('Does a no-op when there are no files to write to', () => {
			const outputFileWriter = CompositeRulesWriter.fromFiles([]);
			const stubbedEmptyRuleSelection = new Stub.StubEmptyRuleSelection();

			outputFileWriter.write(stubbedEmptyRuleSelection);

			expect(writeFileSpy).not.toHaveBeenCalled();
		});

		it('When given multiple files, outputs to all of them', () => {
			const expectations = [{
				file: 'outFile1.json',
				contents: `Rules formatted as ${OutputFormat.JSON}`
			}, {
				file: 'outFile2.json',
				contents: `Rules formatted as ${OutputFormat.JSON}`
			}];
			const outputFileWriter = CompositeRulesWriter.fromFiles(expectations.map(i => i.file));
			const stubbedSelection = new Stub.StubEmptyRuleSelection();

			outputFileWriter.write(stubbedSelection);

			expect(writeFileSpy).toHaveBeenCalledTimes(2);
			expect(writeFileInvocations).toEqual(expectations);
		});
	})
});
