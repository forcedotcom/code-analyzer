import * as path from 'node:path';
import * as fs from 'node:fs';
import {XMLParser} from 'fast-xml-parser';
import {PmdEngine} from '@salesforce/code-analyzer-pmd-engine';
import type {PmdAstDumpResults, GenerateAstOptions} from '@salesforce/code-analyzer-pmd-engine';
import {BundleName, getMessage} from '../messages.js';

export type AstDumpInput = {
	file: string;
	language?: string;
	format: 'json' | 'xml';
	'output-file'?: string;
}

export type AstNode = {
	nodeName: string;
	attributes: Record<string, string>;
	parent: string | null;
	ancestors: string[];
}

export type AstDumpJsonOutput = {
	status: 'success';
	file: string;
	language: string;
	totalNodes: number;
	nodes: AstNode[];
}

export type AstDumpXmlOutput = {
	status: 'success';
	file: string;
	language: string;
	ast: string;
}

export type AstDumpErrorOutput = {
	status: 'error';
	message: string;
}

export type AstDumpOutput = AstDumpJsonOutput | AstDumpXmlOutput | AstDumpErrorOutput;


const LANGUAGE_MAP: Record<string, string> = {
	'.cls': 'apex',
	'.trigger': 'apex',
	'.page': 'visualforce',
	'.component': 'visualforce',
	'.html': 'html',
	'.htm': 'html',
	'.xml': 'xml',
	'.js': 'javascript',
};

const SUPPORTED_LANGUAGES = ['apex', 'visualforce', 'html', 'xml', 'javascript'];

const MAX_FILE_SIZE_BYTES = 1_000_000; // 1MB

export class AstDumpAction {
	public async execute(input: AstDumpInput): Promise<AstDumpOutput> {
		// Validate file exists
		const filePath = path.resolve(input.file);
		if (!fs.existsSync(filePath)) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.fileNotFound', [filePath])};
		}
		if (!fs.statSync(filePath).isFile()) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.notRegularFile', [filePath])};
		}

		// Check file size
		const fileSize = fs.statSync(filePath).size;
		if (fileSize > MAX_FILE_SIZE_BYTES) {
			return {status: 'error', message: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes (${fileSize} bytes). Provide a smaller snippet.`};
		}

		// Determine language
		const language = input.language || this.detectLanguage(filePath);
		if (!language) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.unsupportedLanguage', [filePath])};
		}
		if (!SUPPORTED_LANGUAGES.includes(language)) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.unsupportedLanguage', [filePath])};
		}

		const pmdConfig = this.getDefaultPmdConfig();

		// Create PmdEngine and generate AST
		const pmdEngine = new PmdEngine(pmdConfig as ConstructorParameters<typeof PmdEngine>[0]);
		const options: GenerateAstOptions = {encoding: 'UTF-8'};

		let results: PmdAstDumpResults;
		try {
			results = await pmdEngine.generateAst(language, filePath, options);
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.parseFailed', [errMsg])};
		}

		if (results.error) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.parseFailed', [results.error.message])};
		}

		if (!results.ast) {
			return {status: 'error', message: getMessage(BundleName.AstDumpCommand, 'error.parseFailed', ['No AST generated'])};
		}

		// Format output
		let output: AstDumpOutput;
		if (input.format === 'xml') {
			output = {status: 'success', file: filePath, language, ast: results.ast};
		} else {
			const nodes = this.parseAstXmlToNodes(results.ast);
			output = {status: 'success', file: filePath, language, totalNodes: nodes.length, nodes};
		}

		// Write to file or return
		if (input['output-file']) {
			const outputPath = path.resolve(input['output-file']);
			const content = input.format === 'xml' ? (output as AstDumpXmlOutput).ast : JSON.stringify(output, null, 2);
			fs.writeFileSync(outputPath, content, 'utf-8');
		}

		return output;
	}

	private detectLanguage(filePath: string): string | undefined {
		const ext = path.extname(filePath).toLowerCase();
		return LANGUAGE_MAP[ext];
	}

	private getDefaultPmdConfig(): Record<string, unknown> {
		return {
			java_command: 'java',
			java_classpath_entries: [],
			custom_rulesets: [],
			rule_languages: ['apex', 'visualforce', 'xml', 'html', 'javascript'],
			file_extensions: {
				apex: ['.cls', '.trigger'],
				visualforce: ['.page', '.component'],
				xml: ['.xml'],
				html: ['.html', '.htm'],
				javascript: ['.js']
			}
		};
	}

	private parseAstXmlToNodes(xml: string): AstNode[] {
		const ATTR_PFX = '@_';
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: ATTR_PFX,
			parseAttributeValue: false,
			allowBooleanAttributes: true,
			isArray: () => true,
		});
		const parsed: Record<string, unknown> = parser.parse(xml) as Record<string, unknown>;
		const nodes: AstNode[] = [];
		for (const [rootName, arr] of Object.entries(parsed)) {
			if (Array.isArray(arr)) {
				for (const child of arr as Record<string, unknown>[]) {
					this.walkNode(child, rootName, [], nodes, ATTR_PFX);
				}
			}
		}
		return nodes;
	}

	private walkNode(obj: Record<string, unknown>, nodeName: string, ancestors: string[], nodes: AstNode[], attrPfx: string): void {
		const attributes: Record<string, string> = {};
		const children: Record<string, Record<string, unknown>[]> = {};
		for (const [k, v] of Object.entries(obj)) {
			if (k.startsWith(attrPfx)) {
				const val = Array.isArray(v) ? (v as unknown[])[0] : v;
				attributes[k.slice(attrPfx.length)] = String(val);
			} else {
				children[k] = v as Record<string, unknown>[];
			}
		}
		nodes.push({nodeName, attributes, parent: ancestors.length > 0 ? ancestors[ancestors.length - 1] : null, ancestors: [...ancestors]});
		const nextAncestors = [...ancestors, nodeName];
		for (const [childName, arr] of Object.entries(children)) {
			if (Array.isArray(arr)) {
				for (const child of arr) {
					if (child !== null && typeof child === 'object') {
						this.walkNode(child, childName, nextAncestors, nodes, attrPfx);
					}
				}
			}
		}
	}

	public static createAction(): AstDumpAction {
		return new AstDumpAction();
	}
}
