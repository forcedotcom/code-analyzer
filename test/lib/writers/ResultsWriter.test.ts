import {OutputFormat} from '@salesforce/code-analyzer-core';
import {ResultsFileWriter, CompositeResultsWriter} from '../../../src/lib/writers/ResultsWriter';
import * as StubRunResults from '../../stubs/StubRunResults';
import { StubFileSystem } from '../../stubs/StubFileSystem';

describe('ResultsWriter implementations', () => {
	let fileSystem: StubFileSystem;
	beforeEach(() => {
		fileSystem = new StubFileSystem();
	});

	describe('ResultsFileWriter', () => {
		it.each([
			{ext: '.csv', expectedOutput: `Results formatted as ${OutputFormat.CSV}`},
			{ext: '.html', expectedOutput: `Results formatted as ${OutputFormat.HTML}`},
			{ext: '.htm', expectedOutput: `Results formatted as ${OutputFormat.HTML}`},
			{ext: '.json', expectedOutput: `Results formatted as ${OutputFormat.JSON}`},
			{ext: '.sarif', expectedOutput: `Results formatted as ${OutputFormat.SARIF}`},
			{ext: '.sarif.json', expectedOutput: `Results formatted as ${OutputFormat.SARIF}`},
			{ext: '.xml', expectedOutput: `Results formatted as ${OutputFormat.XML}`}
		])('Accepts and outputs valid file format: *$ext', ({ext, expectedOutput}) => {
			const validFile = `beep${ext}`;
			const outputFileWriter = new ResultsFileWriter(validFile, fileSystem);
			const stubbedResults = new StubRunResults.StubNonEmptyResults();

			outputFileWriter.write(stubbedResults);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(1);
			expect(fileSystem.writeFileSyncCallHistory).toEqual([{
				file: validFile,
				contents: expectedOutput
			}]);
		});

		it('Writes file even when results are empty', () => {
			const expectations = {
				file: 'beep.csv',
				contents: `Results formatted as ${OutputFormat.CSV}`
			};
			const outputFileWriter = new ResultsFileWriter(expectations.file, fileSystem);
			const stubbedResults = new StubRunResults.StubEmptyResults();

			outputFileWriter.write(stubbedResults);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(1);
			expect(fileSystem.writeFileSyncCallHistory).toEqual([expectations]);
		});

		it('Rejects invalid file format: *.txt', () => {
			const invalidFile = 'beep.txt';
			expect(() => new ResultsFileWriter(invalidFile)).toThrow(invalidFile);
		});
	});

	describe('CompositeResultsWriter', () => {
		it('Does a no-op when there are no files to write to', () => {
			const outputFileWriter = CompositeResultsWriter.fromFiles([], fileSystem);
			const stubbedResults = new StubRunResults.StubNonEmptyResults();

			outputFileWriter.write(stubbedResults);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(0);
		});

		it('When given multiple files, outputs to all of them', () => {
			const expectations = [{
				file: 'beep.csv',
				contents: `Results formatted as ${OutputFormat.CSV}`
			}, {
				file: 'beep.xml',
				contents: `Results formatted as ${OutputFormat.XML}`
			}, {
				file: 'beep.json',
				contents: `Results formatted as ${OutputFormat.JSON}`
			}];
			const outputFileWriter = CompositeResultsWriter.fromFiles(expectations.map(i => i.file), fileSystem);
			const stubbedResults = new StubRunResults.StubNonEmptyResults();

			outputFileWriter.write(stubbedResults);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(3);
			expect(fileSystem.writeFileSyncCallHistory).toEqual(expectations);
		});
	})
});
