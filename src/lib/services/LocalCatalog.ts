import {Logger, SfdxError} from '@salesforce/core';
import * as path from 'path';
import {injectable} from 'tsyringe';
import {CATALOG_FILE} from '../../Constants';
import {Catalog, Rule, RuleEvent, RuleGroup} from '../../types';
import {OutputProcessor} from '../pmd/OutputProcessor';
import {FilterType, RuleFilter} from '../RuleFilter';
import {FileHandler} from '../util/FileHandler';
import * as PrettyPrinter from '../util/PrettyPrinter';
import {RuleCatalog} from './RuleCatalog';
import {RuleEngine} from './RuleEngine';
import { Controller } from '../../Controller';

@injectable()
export default class LocalCatalog implements RuleCatalog {

	private logger: Logger;
	private outputProcessor: OutputProcessor;
	private catalog: Catalog;
	private sfdxScannerPath: string;

	private engines: RuleEngine[];
	private initialized: boolean;

	async init(): Promise<void> {
		if (this.initialized) {
			return;
		}
		this.logger = await Logger.child("LocalCatalog");
		this.sfdxScannerPath = Controller.getSfdxScannerPath();
		// The catalog consists of all engines, even those that may be disabled.
		// This is currently necessary because the user can specify a disabled engine, revisit when we don't overwrite the catalog on each run.
		this.engines = await Controller.getAllEngines();

		this.outputProcessor = await OutputProcessor.create({}); // TODO should be an injected service
		this.catalog = await this.getCatalog();

		this.initialized = true;
	}

	/**
	 * Accepts a set of filter criteria, and returns the paths of all categories and rulesets matching those criteria.
	 * @param {RuleFilter[]} filters
	 */
	public getRuleGroupsMatchingFilters(filters: RuleFilter[]): RuleGroup[] {
		this.logger.trace(`Getting paths that match filters ${PrettyPrinter.stringifyRuleFilters(filters)}`);

		// If we weren't given any filters, that should be treated as implicitly including all rules. Since PMD defines its
		// rules in category files, we should just return all paths corresponding to a category.
		if (!filters || filters.length === 0) {
			return this.getAllCategoryPaths();
		}
		// If we actually do have filters, we'll want to iterate over all of them and see which ones
		// correspond to a path in the catalog.
		// Since categories and rulesets are both just NamedPaths, we can put both types of
		// path into a single array and return that.
		const foundPaths: RuleGroup[] = [];
		for (const filter of filters) {
			// For now, we only care about filters that act on rulesets and categories.
			const type = filter.filterType;
			if (type === FilterType.CATEGORY || type === FilterType.RULESET) {
				// We only want to evaluate category filters against category names, and ruleset filters against ruleset names.
				const namedPaths: RuleGroup[] = type === FilterType.CATEGORY ? this.catalog.categories : this.catalog.rulesets;
				for (const value of filter.filterValues) {
					// If there's a matching category/ruleset for the specified filter, we'll need to add all the
					// corresponding paths to our list.
					const np = namedPaths.filter(np => np.name === value);
					foundPaths.push(...np);
				}
			}
		}
		return foundPaths;
	}

	getRulesMatchingFilters(filters: RuleFilter[]): Rule[] {
		this.logger.trace(`Fetching rules that match the criteria ${PrettyPrinter.stringifyRuleFilters(filters)}`);

		try {
			const rulesThatMatchCriteria = this.catalog.rules.filter(rule => this.ruleSatisfiesFilterConstraints(rule, filters));
			this.logger.trace(`Rules that match the criteria: ${PrettyPrinter.stringifyRules(rulesThatMatchCriteria)}`);
			return rulesThatMatchCriteria;
		} catch (e) {
			throw new SfdxError(e.message || e);
		}
	}

	private getAllCategoryPaths(): RuleGroup[] {
		// Since this method is run when no filter criteria are provided, it might be nice to provide a level of visibility
		// into all of the categories that were run. So before returning the category paths, loop through them
		// and emit events for each path.

		const events: RuleEvent[] = [];
		this.catalog.categories.forEach(cat => {
			events.push({
				messageKey: 'info.categoryImplicitlyRun',
				args: [cat.engine, cat.name],
				type: 'INFO',
				handler: 'UX',
				verbose: true,
				time: Date.now()
			});
		});

		this.outputProcessor.emitEvents(events);
		return this.catalog.categories;
	}

	private static getCatalogName(): string {
		// For test mocking purposes, we allow for env variables to override the default catalog name.
		return process.env.CATALOG_FILE || CATALOG_FILE;
	}

	private getCatalogPath(): string {
		return path.join(this.sfdxScannerPath, LocalCatalog.getCatalogName());
	}

	private async readCatalogJson(): Promise<Catalog> {
		const rawCatalog = await new FileHandler().readFile(this.getCatalogPath());
		return JSON.parse(rawCatalog);
	}

	private async writeCatalogJson(content: Catalog): Promise<void> {
		return new FileHandler().writeFile(this.getCatalogPath(), JSON.stringify(content, null, 2));
	}

	public async getCatalog(): Promise<Catalog> {
		// If we haven't read in a catalog yet, do so now.
		if (!this.catalog) {
			this.logger.trace(`Populating Catalog JSON.`);
			await this.rebuildCatalogIfNecessary();
			this.catalog = await this.readCatalogJson();
		}
		return Promise.resolve(this.catalog);
	}

	private async rebuildCatalogIfNecessary(): Promise<[boolean, string]> {
		// First, check whether the catalog is stale. If it's not, we don't even need to do anything.
		if (!LocalCatalog.catalogIsStale()) {
			return new Promise<[boolean, string]>(() => [false, 'no action taken']);
		}

		return this.rebuildCatalog();
	}

	/**
	 * Recreate the catalog from the catalogs of each engine and write the catalog json to disk.
	 */
	private async rebuildCatalog(): Promise<[boolean, string]> {
		const catalog = this.catalog = {rulesets: [], categories: [], rules: []};
		for (const engine of this.engines) {
			const engineCatalog: Catalog = await engine.getCatalog();
			catalog.rulesets.push(...engineCatalog.rulesets);
			catalog.categories.push(...engineCatalog.categories);
			catalog.rules.push(...engineCatalog.rules);
		}
		await this.writeCatalogJson(this.catalog);
		return Promise.resolve([true, 'rebuilt catalog']);
	}

	private static catalogIsStale(): boolean {
		// TODO: Pretty soon, we'll want to add sophisticated logic to determine whether the catalog is stale. But for now,
		//  we'll just return true so we always rebuild the catalog.
		return true;
	}

	private ruleSatisfiesFilterConstraints(rule: Rule, filters: RuleFilter[]): boolean {
		// If no filters were provided, then the rule is acceptable if enabled by default
		if (filters == null || filters.length === 0) {
			return rule.defaultEnabled;
		}

		// Otherwise, we'll iterate over all provided criteria and make sure that the rule satisfies them.
		for (const filter of filters) {
			const filterType = filter.filterType;
			const filterValues = filter.filterValues;

			// Which property of the rule we're testing against depends on this filter's type.
			let ruleValues = null;
			switch (filterType) {
				case FilterType.CATEGORY:
					ruleValues = rule.categories;
					break;
				case FilterType.RULESET:
					ruleValues = rule.rulesets;
					break;
				case FilterType.LANGUAGE:
					ruleValues = rule.languages;
					break;
				case FilterType.RULENAME:
					// Rules only have one name, so we'll just turn that name into a singleton list so we can compare names the
					// same way we compare everything else.
					ruleValues = [rule.name];
					break;
				case FilterType.SOURCEPACKAGE:
					// Rules have one source package, so we'll turn it into a singleton list just like we do with 'name'.
					ruleValues = [rule.sourcepackage];
					break;
				case FilterType.ENGINE:
					// Rules have one engine, so we'll turn it into a singleton list just like we do with 'name'.
					ruleValues = [rule.engine];
					break;
			}

			// For each filter, one of the values it specifies as acceptable must be present in the rule's corresponding list.
			// e.g., if the user specified one or more categories, the rule must be a member of at least one of those categories.
			if (filterValues.length > 0 && !this.listContentsOverlap(filterValues, ruleValues)) {
				return false;
			}
		}
		// If we're at this point, it's because we looped through all of the filter criteria without finding a single one that
		// wasn't satisfied, which means the rule is good.
		return true;
	}

	private listContentsOverlap<T>(list1: ReadonlyArray<T>, list2: T[]): boolean {
		return list1.some(x => list2.includes(x));
	}
}
