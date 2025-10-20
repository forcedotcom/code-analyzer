import * as path from "path";
import { OutputFormat, RuleSelection } from "@salesforce/code-analyzer-core";
import { BundleName, getMessage } from "../messages";
import { FileSystem, RealFileSystem } from "../utils/FileUtil";

export interface RulesWriter {
    write(rules: RuleSelection): void;
}

export class CompositeRulesWriter implements RulesWriter {
    private readonly writers: RulesWriter[] = [];

    private constructor(writers: RulesWriter[]) {
        this.writers = writers;
    }

    public write(rules: RuleSelection): void {
        this.writers.forEach(w => w.write(rules));
    }

    public static fromFiles(files: string[], fileSystem: FileSystem = new RealFileSystem()): CompositeRulesWriter {
        return new CompositeRulesWriter(files.map(f => new RulesFileWriter(f, fileSystem)));
    }
}

export class RulesFileWriter implements RulesWriter {
    private readonly file: string;
    private readonly format: OutputFormat;
    private readonly fileSystem: FileSystem;

    public constructor(file: string, fileSystem: FileSystem = new RealFileSystem()) {
        this.file = file;

        const ext = path.extname(file).toLowerCase();
        if (ext === '.json') {
			this.format = OutputFormat.JSON;
		} else if (ext === '.csv') {
			this.format = OutputFormat.CSV;
        } else {
            throw new Error(getMessage(BundleName.RulesWriter, 'error.unrecognized-file-format', [file]));
        }

        this.fileSystem = fileSystem;
    }

    public write(ruleSelection: RuleSelection): void {
        const contents = ruleSelection.toFormattedOutput(this.format);
        this.fileSystem.writeFileSync(this.file, contents);
    }
}
