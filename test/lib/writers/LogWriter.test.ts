import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {LogFileWriter} from '../../../src/lib/writers/LogWriter.js';
import {Clock} from '../../../src/lib/utils/DateTimeUtils.js';

describe('LogWriter implementations', () => {

	describe('LogFileWriter', () => {
		it('Writes properly-named file to config-specified folder', async () => {
			const tempFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tmp-'));

			// ==== TEST SETUP ====
			const config = CodeAnalyzerConfig.fromObject({log_folder: tempFolder});
			const fixedDate: Date = new Date(2025, 1, 20, 14, 30, 18, 14);
			const logWriter = await LogFileWriter.fromConfig(config, new FixedClock(fixedDate));

			// ==== TESTED BEHAVIOR ====
			logWriter.writeToLog('beep');
			logWriter.writeToLog('boop');
			logWriter.writeToLog('bop');

			logWriter.closeLog();

			// ==== ASSERTIONS ====
			const logFolderContents = await fs.promises.readdir(tempFolder);
			expect(logFolderContents).toHaveLength(1);
			const logFilePath = path.join(tempFolder, logFolderContents[0]);
			expect(path.basename(logFilePath)).toEqual('sfca-2025_02_20_14_30_18_014.log');
			const logFileContents = await fs.promises.readFile(logFilePath, 'utf-8');
			expect(logFileContents).toContain('beep');
			expect(logFileContents).toContain('boop');
			expect(logFileContents).toContain('bop');
		});
	});
});

class FixedClock implements Clock {
	private readonly fixedDate: Date;

	public constructor(fixedDate: Date) {
		this.fixedDate = fixedDate;
	}

	public now(): Date {
		return this.fixedDate;
	}
}
