import * as path from 'node:path';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {Clock, RealClock, formatToDateTimeString} from '../utils/DateTimeUtils.js';
import {FileSystem, RealFileSystem, WriteStream} from '../utils/FileUtil.js';

export interface LogWriter {
	writeToLog(message: string): void;
	getLogDestination(): string;
	closeLog(): void;
}

export class LogFileWriter implements LogWriter {
	private readonly writeStream: WriteStream;
	private readonly destination: string;

	private constructor(writeStream: WriteStream, destination: string) {
		this.writeStream = writeStream;
		this.destination = destination;
	}

	public writeToLog(message: string): void {
		this.writeStream.write(message);
	}

	public getLogDestination(): string {
		return this.destination;
	}

	public closeLog(): void {
		this.writeStream.end();
	}

	public static async fromConfig(config: CodeAnalyzerConfig, clock: Clock = new RealClock(), fileSystem: FileSystem = new RealFileSystem()): Promise<LogFileWriter> {
		const logFolder = config.getLogFolder();

		// Use the current timestamp to make sure each transaction has a unique logfile. If we want to reuse logfiles,
		// or just have one running logfile, we can change this.
		const logFile = path.join(logFolder, `sfca-${formatToDateTimeString(clock.now())}.log`);

		return new LogFileWriter(await fileSystem.createWriteStream(logFile), logFile);
	}
}
