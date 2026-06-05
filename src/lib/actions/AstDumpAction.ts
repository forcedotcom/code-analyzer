import * as path from 'node:path';
import * as fs from 'node:fs';
import {CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {PmdEngine} from '@salesforce/code-analyzer-pmd-engine';
import type {PmdAstDumpResults, GenerateAstOptions} from '@salesforce/code-analyzer-pmd-engine';
import {CodeAnalyzerConfigFactory} from '../factories/CodeAnalyzerConfigFactory.js';
import {BundleName, getMessage} from '../messages.js';

export type AstDumpInput = {
	file: string;
	language?: string;
	format: 'json' | 'xml';
	'output-file'?: string;
	'config-file'?: string;
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

export type AstDumpDependencies = {
	configFactory: CodeAnalyzerConfigFactory;
}

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
	private readonly dependencies: AstDumpDependencies;

	constructor(dependencies: AstDumpDependencies) {
		this.dependencies = dependencies;
	}

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

		// Get config for java_command resolution
		const config: CodeAnalyzerConfig = this.dependencies.configFactory.create(input['config-file']);
		const pmdConfig = this.extractPmdConfig(config);

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

	private extractPmdConfig(config: CodeAnalyzerConfig): Record<string, unknown> {
		const overrides = config.getEngineOverridesFor('pmd') as Record<string, unknown>;
		return {
			java_command: overrides.java_command || 'java',
			java_classpath_entries: overrides.java_classpath_entries || [],
			custom_rulesets: overrides.custom_rulesets || [],
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

	/**
	 * Parse PMD AST XML into a flat list of nodes with ancestry information.
	 * Each node gets: nodeName, attributes (key-value pairs), parent, ancestors chain.
	 */
	private parseAstXmlToNodes(xml: string): AstNode[] {
		const nodes: AstNode[] = [];
		this.traverseXml(xml, nodes);
		return nodes;
	}

	/**
	 * Simple XML parser for PMD AST output.
	 * PMD AST XML has a predictable structure: nested elements with attributes.
	 * We parse it using regex-based tag extraction (safe for well-formed PMD output).
	 */
	private traverseXml(xml: string, nodes: AstNode[]): void {
		const tagRegex = /<(\w+)([^>]*?)(\/>|>)/g;
		const closeTagRegex = /<\/(\w+)>/g;

		const ancestorStack: string[] = [];
		let match: RegExpExecArray | null;

		// Build a simple event-based parser
		const events: Array<{type: 'open' | 'close' | 'selfclose'; name: string; attrs: string; pos: number}> = [];

		// Find all opening/self-closing tags
		tagRegex.lastIndex = 0;
		while ((match = tagRegex.exec(xml)) !== null) {
			const [, name, attrs, closing] = match;
			if (name === '?xml') continue; // Skip XML declaration
			events.push({
				type: closing === '/>' ? 'selfclose' : 'open',
				name,
				attrs: attrs || '',
				pos: match.index
			});
		}

		// Find all closing tags
		closeTagRegex.lastIndex = 0;
		while ((match = closeTagRegex.exec(xml)) !== null) {
			events.push({type: 'close', name: match[1], attrs: '', pos: match.index});
		}

		// Sort by position in document
		events.sort((a, b) => a.pos - b.pos);

		// Process events in order
		for (const event of events) {
			if (event.type === 'open') {
				const attributes = this.parseAttributes(event.attrs);
				nodes.push({
					nodeName: event.name,
					attributes,
					parent: ancestorStack.length > 0 ? ancestorStack[ancestorStack.length - 1] : null,
					ancestors: [...ancestorStack]
				});
				ancestorStack.push(event.name);
			} else if (event.type === 'selfclose') {
				const attributes = this.parseAttributes(event.attrs);
				nodes.push({
					nodeName: event.name,
					attributes,
					parent: ancestorStack.length > 0 ? ancestorStack[ancestorStack.length - 1] : null,
					ancestors: [...ancestorStack]
				});
			} else if (event.type === 'close') {
				ancestorStack.pop();
			}
		}
	}

	/**
	 * Parse XML attributes from a string like: Name="value" Other="value2"
	 */
	private parseAttributes(attrString: string): Record<string, string> {
		const attrs: Record<string, string> = {};
		const attrRegex = /(\w+)\s*=\s*(['"])(.*?)\2/g;
		let match: RegExpExecArray | null;
		while ((match = attrRegex.exec(attrString)) !== null) {
			attrs[match[1]] = match[3];
		}
		return attrs;
	}

	public static createAction(dependencies: AstDumpDependencies): AstDumpAction {
		return new AstDumpAction(dependencies);
	}
}
