import * as path from 'node:path';
import {ConfigModel, OutputFormat} from '../models/ConfigModel';
import {BundleName, getMessage} from '../messages';
import {Display} from '../Display';
import {FileSystem, RealFileSystem} from '../utils/FileUtil';

export interface ConfigWriter {
	write(model: ConfigModel): Promise<boolean>;
}

export class ConfigFileWriter implements ConfigWriter {
	private readonly file: string;
	private readonly format: OutputFormat;
	private readonly display: Display;
	private readonly fileSystem: FileSystem;

	private constructor(file: string, format: OutputFormat, display: Display, fileSystem: FileSystem) {
		this.file = file;
		this.format = format;
		this.display = display;
		this.fileSystem = fileSystem;
	}

	public async write(model: ConfigModel): Promise<boolean> {
		// Only write to the file if it doesn't already exist, or if the user confirms that they want to overwrite it.
		if (!(await this.fileSystem.exists(this.file)) || await this.display.confirm(getMessage(BundleName.ConfigWriter, 'prompt.overwrite-existing-file', [this.file]))) {
			this.fileSystem.writeFileSync(this.file, model.toFormattedOutput(this.format));
			return true;
		} else {
			return false;
		}
	}

	public static fromFile(file: string, display: Display, fileSystem: FileSystem = new RealFileSystem()): ConfigFileWriter {
		const ext = path.extname(file).toLowerCase();
		if (ext === '.yaml' || ext === '.yml') {
			return new ConfigFileWriter(file, OutputFormat.RAW_YAML, display, fileSystem);
		} else {
			throw new Error(getMessage(BundleName.ConfigWriter, 'error.unrecognized-file-format', [file]));
		}
	}
}
