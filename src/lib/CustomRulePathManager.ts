import path = require('path');
import {FileHandler} from './util/FileHandler';
import {Logger, SfdxError} from '@salesforce/core';
import {AsyncCreatable} from '@salesforce/kit';
import {CUSTOM_PATHS, SFDX_SCANNER_PATH} from '../Constants';
import * as PrettyPrinter from './util/PrettyPrinter';

export enum ENGINE {
	PMD = 'pmd'
}

type RulePathEntry = Map<string, Set<string>>;
type RulePathMap = Map<ENGINE, RulePathEntry>;

export const CUSTOM_CLASSPATH_REGISTER = path.join(SFDX_SCANNER_PATH, CUSTOM_PATHS);
export const CUSTOM_CLASSPATH_REGISTER_TMP = path.join(SFDX_SCANNER_PATH, `Tmp${CUSTOM_PATHS}`);

const EMPTY_JSON_FILE = '{}';


export class CustomRulePathManager extends AsyncCreatable {
	private logger!: Logger;
	private pathsByLanguageByEngine: RulePathMap;
	private initialized: boolean;
	private fileHandler: FileHandler;


	protected async init(): Promise<void> {
		this.logger = await Logger.child('CustomRulePathManager');
		this.pathsByLanguageByEngine = new Map();
		this.fileHandler = new FileHandler();
		this.initialized = false;
	}

	private async initialize(): Promise<void> {
		if (this.initialized) {
			this.logger.trace(`CustomRulePathManager has already been initialized`);
			return;
		}

		this.logger.trace(`Initializing CustomRulePathManager.`);

		// Read from the JSON and use it to populate the map.
		let data = null;
		try {
			const customRulePathFile = CustomRulePathManager.getFilePath();
			data = await this.fileHandler.readFile(customRulePathFile);
			this.logger.trace(`CustomRulePath content from ${customRulePathFile}: ${data}`);
		} catch (e) {
			// An ENOENT error is fine, because it just means the file doesn't exist yet. We'll respond by spoofing a JSON with
			// no information in it.
			if (e.code === 'ENOENT') {
				this.logger.trace(`CustomRulePath file does not exist yet. In the process of creating a new file.`);
				data = EMPTY_JSON_FILE;
			} else {
				//  Any other error needs to be rethrown, and since it could be arcane or weird, we'll also prepend it with a
				//  header so it's clear where it came from.
				throw SfdxError.create('@salesforce/sfdx-scanner', 'add', 'errors.readCustomRulePathFileFailed', [e.message]);
			}
		}
		// If file existed but was empty, replace the whitespace/blank with empty JSON
		if ('' === data.trim()) {
			this.logger.trace(`CustomRulePath file existed, but was empty.`);
			data = EMPTY_JSON_FILE;
		}
		// Now that we've got the file contents, let's turn it into a JSON.
		const json = JSON.parse(data);
		this.pathsByLanguageByEngine = this.convertJsonDataToMap(json);
		this.logger.trace(`Initialized CustomRulePathManager. pathsByLanguageByEngine: ${PrettyPrinter.stringifyMapOfMaps(this.pathsByLanguageByEngine)}`);
		this.initialized = true;
	}

	public async addPathsForLanguage(language: string, paths: string[]): Promise<string[]> {
		await this.initialize();

		this.logger.trace(`About to add paths[${paths}] for language ${language}`);
		const classpathEntries = await this.expandClasspaths(paths);
		// Identify the engine for each path and put them in the appropriate map and inner map.
		classpathEntries.forEach((entry) => {
			const e = this.determineEngineForPath(entry);
			if (!this.pathsByLanguageByEngine.has(e)) {
				this.logger.trace(`Creating new entry for engine ${e}`);
				this.pathsByLanguageByEngine.set(e, new Map());
			}
			if (!this.pathsByLanguageByEngine.get(e).has(language)) {
				this.logger.trace(`Creating new entry for language ${language} in engine ${e}`);
				this.pathsByLanguageByEngine.get(e).set(language, new Set([entry]));
			} else {
				this.pathsByLanguageByEngine.get(e).get(language).add(entry);
			}
		});
		// Now, write the changes to the file.
		await this.saveCustomClasspaths();
		return classpathEntries;
	}

	public async getRulePathEntries(engine: ENGINE): Promise<Map<string, Set<string>>> {
		await this.initialize();

		if (!this.pathsByLanguageByEngine.has(engine)) {
			this.logger.trace(`CustomRulePath does not have entries for engine ${engine}`);
			return new Map();
		}

		return this.pathsByLanguageByEngine.get(engine);
	}

	private async saveCustomClasspaths(): Promise<void> {
		await this.initialize();
		try {
			const fileContent = JSON.stringify(this.convertMapToJson(), null, 4);
			this.logger.trace(`Writing file content to CustomRulePath file [${CustomRulePathManager.getFilePath()}]: ${fileContent}`);
			await this.fileHandler.mkdirIfNotExists(SFDX_SCANNER_PATH);
			await this.fileHandler.writeFile(CustomRulePathManager.getFilePath(), fileContent);

		} catch (e) {
			// If the write failed, the error might be arcane or confusing, so we'll want to prepend the error with a header
			// so it's at least obvious what failed, if not how or why.
			throw SfdxError.create('@salesforce/sfdx-scanner', 'add', 'errors.writeCustomRulePathFileFailed', [e.message]);
		}
	}

	private convertJsonDataToMap(json): RulePathMap {
		const map = new Map();
		for (const key of Object.keys(json)) {
			const engine = key as ENGINE;
			const val = json[key];
			const innerMap = new Map();
			for (const lang of Object.keys(val)) {
				innerMap.set(lang, new Set(val[lang]));
			}
			map.set(engine, innerMap);
		}
		return map;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private determineEngineForPath(path: string): ENGINE {
		// TODO: Once we support other engines, we'll need more logic here.
		return ENGINE.PMD;
	}

	private convertMapToJson(): object {
		const json = {};
		this.pathsByLanguageByEngine.forEach((pathsByLang, engine) => {
			const innerObj = {};
			pathsByLang.forEach((paths, lang) => {
				innerObj[lang] = Array.from(paths);
			});
			json[engine.toString()] = innerObj;
		});
		return json;
	}

	private static getFileName(): string {
		// We must allow for env variables to override the default catalog name. This must be recomputed in case those variables
		// have different values in different test runs.
		return process.env.CUSTOM_PATH_FILE || CUSTOM_PATHS;
	}

	private static getFilePath(): string {
		return path.join(SFDX_SCANNER_PATH, this.getFileName());
	}

	private async expandClasspaths(paths: string[]): Promise<string[]> {
		const classpathEntries: string[] = [];
		for (const p of paths) {
			let stats;
			try {
				this.logger.trace(`Fetching stats for path ${p}`);
				stats = await this.fileHandler.stats(p);
			} catch (e) {
				throw SfdxError.create('@salesforce/sfdx-scanner', 'add', 'errors.invalidFilePath', [p]);
			}
			if (stats.isFile()) {
				if (p.endsWith(".jar")) {
					// Simple filename check for .jar is enough.
					this.logger.trace(`Adding JAR directly provided as a path: ${p}`);
					classpathEntries.push(p);
				}
			} else if (stats.isDirectory()) {
				// TODO: Once we add support for other engines, we'll need to check whether the directory contains things other than JARs.
				// Look inside directories for jar files, but not recursively.
				const files = await this.fileHandler.readDir(p);
				for (const file of files) {
					if (file.endsWith(".jar")) {
						const filePath = path.resolve(p, file);
						this.logger.trace(`Adding JAR found inside a directory provided as a path: ${filePath}`);
						classpathEntries.push(filePath);
					}
				}
			}
		}
		return classpathEntries;
	}
}

