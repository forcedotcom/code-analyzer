import * as path from 'node:path';
import {OutputFormat, RunResults} from '@salesforce/code-analyzer-core';
import {BundleName, getMessage} from '../messages.js';
import {FileSystem, RealFileSystem} from '../utils/FileUtil.js';

export interface ResultsWriter {
	write(results: RunResults): void;
}

export class CompositeResultsWriter implements ResultsWriter {
	private readonly writers: ResultsWriter[] = [];

	private constructor(writers: ResultsWriter[]) {
		this.writers = writers;
	}

	public write(results: RunResults): void {
		this.writers.forEach(w => w.write(results));
	}

	public static fromFiles(files: string[], fileSystem: FileSystem = new RealFileSystem()): CompositeResultsWriter {
		return new CompositeResultsWriter(files.map(f => new ResultsFileWriter(f, fileSystem)));
	}
}

export class ResultsFileWriter implements ResultsWriter {
	private readonly file: string;
	private readonly format: OutputFormat;
	private readonly fileSystem: FileSystem;

	public constructor(file: string, fileSystem: FileSystem = new RealFileSystem()) {
		this.file = file;
		const ext = path.extname(file).toLowerCase();
		if (ext === '.csv') {
			this.format = OutputFormat.CSV;
		} else if (['.html', '.htm'].includes(ext)) {
			this.format = OutputFormat.HTML;
		} else if (ext === '.sarif' || file.toLowerCase().endsWith('.sarif.json')) {
			this.format = OutputFormat.SARIF;
		// Check for `.json` AFTER checking for `.sarif.json`!
		} else if (ext === '.json') {
			this.format = OutputFormat.JSON;
		} else if (ext === '.xml') {
			this.format = OutputFormat.XML;
		} else {
			throw new Error(getMessage(BundleName.ResultsWriter, 'error.unrecognized-file-format', [file]));
		}
		this.fileSystem = fileSystem;
	}

	public write(results: RunResults): void {
		this.fileSystem.writeFileSync(this.file, results.toFormattedOutput(this.format));
	}
}
