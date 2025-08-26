import * as fs from 'node:fs';
import { OutputFormat, RuleSelection } from "@salesforce/code-analyzer-core";
import path from "path";
import { BundleName, getMessage } from "../messages";

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

    public static fromFiles(files: string[]): CompositeRulesWriter {
        return new CompositeRulesWriter(files.map(f => new RulesFileWriter(f)));
    }
}

export class RulesFileWriter implements RulesWriter {
    private readonly file: string;
    private readonly format: OutputFormat;

    public constructor(file: string) {
        this.file = file;
        const ext = path.extname(file).toLowerCase();

        if (ext === '.json') {
			this.format = OutputFormat.JSON;
		} else if (ext === '.csv') {
			this.format = OutputFormat.CSV;
        } else {
            throw new Error(getMessage(BundleName.RulesWriter, 'error.unrecognized-file-format', [file]));
        }
    }

    public write(ruleSelection: RuleSelection): void {
        const contents = ruleSelection.toFormattedOutput(this.format);
        fs.writeFileSync(this.file, contents);
    }
}
