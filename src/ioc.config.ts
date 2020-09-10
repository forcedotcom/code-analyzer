import "reflect-metadata";

import {container} from "tsyringe";
import {CustomRulePathManager} from './lib/CustomRulePathManager';
import {DefaultRuleManager} from './lib/DefaultRuleManager';
import {JavascriptEslintEngine} from './lib/eslint/EslintEngine';
import {LWCEslintEngine} from './lib/eslint/EslintEngine';
import {TypescriptEslintEngine} from './lib/eslint/EslintEngine';
import {PmdEngine} from './lib/pmd/PmdEngine';
import LocalCatalog from './lib/services/LocalCatalog';
import {Config} from './lib/util/Config';
import {ProdOverrides, Services} from './Constants';

function setupProd(): void {
	// This method may be called more than once in unit test scenarios where
	// the test sets up the ioc container and the oclif testing framework is used.
	// The first caller wins. In production this will be called once.
	if (!container.isRegistered(Services.EnvOverridable)) {
		container.register(Services.EnvOverridable, ProdOverrides);
	}
}

/**
 * Initialize the ioc container with singletons common to test and prod
 */
export function registerAll(): void {
	// See #setupProd comment above
	if (!container.isRegistered(Services.Config)) {
		container.registerSingleton(Services.Config, Config);
		container.registerSingleton(Services.RuleManager, DefaultRuleManager);
		container.registerSingleton(Services.RuleEngine, PmdEngine);
		container.registerSingleton(Services.RuleEngine, JavascriptEslintEngine);
		container.registerSingleton(Services.RuleEngine, LWCEslintEngine);
		container.registerSingleton(Services.RuleEngine, TypescriptEslintEngine);
		container.registerSingleton(Services.RuleCatalog, LocalCatalog);
		container.registerSingleton(Services.RulePathManager, CustomRulePathManager);
	}
}

/**
 * Initialize the ioc container for a production environment
 */
export function initContainer(): void {
	setupProd();
	registerAll();
}
