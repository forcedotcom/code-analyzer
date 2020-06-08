import {Logger, SfdxError,} from '@salesforce/core';
import * as assert from 'assert';
import {Stats} from 'fs';
import {inject, injectable, injectAll} from 'tsyringe';
import {Rule, RuleGroup, RuleResult, RuleTarget} from '../types';
import {RuleFilter} from './RuleFilter';
import {OUTPUT_FORMAT, RuleManager} from './RuleManager';
import {RuleResultRecombinator} from './RuleResultRecombinator';
import {RuleCatalog} from './services/RuleCatalog';
import {RuleEngine} from './services/RuleEngine';
import {FileHandler} from './util/FileHandler';
import globby = require('globby');
import picomatch = require('picomatch');
import path = require('path');

@injectable()
export class DefaultRuleManager implements RuleManager {
	private logger: Logger;

	// noinspection JSMismatchedCollectionQueryUpdate
	private readonly engines: RuleEngine[];
	private readonly catalog: RuleCatalog;
	private fileHandler: FileHandler;
	private initialized: boolean;

	constructor(
		@injectAll("RuleEngine") engines?: RuleEngine[],
		@inject("RuleCatalog") catalog?: RuleCatalog
	) {
		this.engines = engines;
		this.catalog = catalog;
	}

	async init(): Promise<void> {
		if (this.initialized) {
			return;
		}
		this.logger = await Logger.child('DefaultManager');
		this.fileHandler = new FileHandler();
		for (const engine of this.engines) {
			await engine.init();
		}
		await this.catalog.init();

		this.initialized = true;
	}

	async getRulesMatchingCriteria(filters: RuleFilter[]): Promise<Rule[]> {
		return this.catalog.getRulesMatchingFilters(filters);
	}

	async runRulesMatchingCriteria(filters: RuleFilter[], targets: string[], format: OUTPUT_FORMAT): Promise<string | { columns; rows }> {
		let results: RuleResult[] = [];

		// Derives rules from our filters to feed the engines.
		const ruleGroups: RuleGroup[] = await this.catalog.getRuleGroupsMatchingFilters(filters);
		const rules: Rule[] = await this.catalog.getRulesMatchingFilters(filters);
		const ps: Promise<RuleResult[]>[] = [];
		for (const e of this.engines) {
			// For each engine, filter for the appropriate groups and rules and targets, and pass
			// them all in. Note that some engines (pmd) need groups while others (eslint) need the rules.
			const engineGroups = ruleGroups.filter(g => g.engine === e.getName());
			const engineRules = rules.filter(r => r.engine === e.getName());
			const engineTargets = await this.unpackTargets(e, targets);
			ps.push(e.run(engineGroups, engineRules, engineTargets));
		}

		// Execute all run promises, each of which returns an array of RuleResults, then concatenate
		// all of the results together from all engines into one report.
		try {
			const psResults: RuleResult[][] = await Promise.all(ps);
			psResults.forEach(r => results = results.concat(r));
			this.logger.trace(`Received rule violations: ${results}`);
			this.logger.trace(`Recombining results into requested format ${format}`);
			return RuleResultRecombinator.recombineAndReformatResults(results, format);
		} catch (e) {
			throw new SfdxError(e.message || e);
		}
	}

	/**
	 * Given a simple list of top-level targets and the engine to be executed, retrieve the full file listing
	 * to target.
	 * 1. If a target has a pattern (i.e. hasMagic) resolve it using globby.
	 * 2. If a target is a directory, get its contents using the target patterns specified for the engine.
	 * 3. If the target is a file, make sure it matches the engine's target patterns.
	 */
	private async unpackTargets(engine: RuleEngine, targets: string[]): Promise<RuleTarget[]> {
		const ruleTargets: RuleTarget[] = [];
		for (const target of targets) {
			// Ask engines for their desired target patterns.
			const targetPatterns: string[] = await engine.getTargetPatterns(target);
			assert(targetPatterns);
			const isInclusiveMatch = picomatch(targetPatterns.filter(p => !p.startsWith("!")));
			const isExclusiveMatch = picomatch(targetPatterns.filter(p => p.startsWith("!")));

			const fileExists = await this.fileHandler.exists(target);
			if (globby.hasMagic(target)) {
				// The target is a magic globby glob.  Retrieve paths in the working dir that match it, and then
				// filter each with the engine's own patterns.  First test any inclusive patterns, then AND them with
				// any exclusive patterns.
				const matchingTargets = await globby(target);
				const ruleTarget = {
					target,
					paths: matchingTargets.filter(t => isInclusiveMatch(path.resolve(t)) && isExclusiveMatch(path.resolve(t)))
				};
				if (ruleTarget.paths.length > 0) {
					ruleTargets.push(ruleTarget);
				}
			} else {
				if (fileExists) {
					const stats: Stats = await this.fileHandler.stats(target);
					if (stats.isDirectory()) {
						// The target is a directory.  If the engine has target patterns, which is always should,
						// call globby with the directory as the working dir, and use the patterns to match its contents.
						if (targetPatterns) {
							// If dir, use globby { cwd: process.cwd() } option
							const relativePaths = await globby(targetPatterns, {cwd: target});
							ruleTargets.push({target, isDirectory: true, paths: relativePaths});
						} else {
							// Without target patterns for the engine, just add the dir itself and hope for the best.
							ruleTargets.push({target, isDirectory: true, paths: ["."]});
						}
					} else {
						// The target is a simple file.  Validate it against the engine's own patterns.  First test
						// any inclusive patterns, then with any exclusive patterns.
						if (isInclusiveMatch(path.resolve(target)) && isExclusiveMatch(path.resolve(target))) {
							ruleTargets.push({target, paths: [target]});
						}
					}
				}
			}
		}
		return ruleTargets;
	}
}
