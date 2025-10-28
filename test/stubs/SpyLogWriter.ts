import {LogWriter} from '../../src/lib/writers/LogWriter.js';

export class SpyLogWriter implements LogWriter {
	private log: string;
	private isClosed: boolean;

	public constructor() {
		this.log = '';
		this.isClosed = false;
	}

	public writeToLog(message: string): void {
		this.log += message;
	}

	public getLogDestination(): string {
		return 'this value does not matter';
	}

	public closeLog(): void {
		this.isClosed = true;
	}

	public getWrittenLog(): string {
		return this.log;
	}

	public getIsClosed(): boolean {
		return this.isClosed;
	}

}
