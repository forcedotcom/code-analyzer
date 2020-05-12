import "reflect-metadata";

import {container} from "tsyringe";
import {CustomRulePathManager} from './lib/CustomRulePathManager';
import {DefaultRuleManager} from './lib/DefaultRuleManager';
import {ESLintEngine} from './lib/eslint/ESLintEngine';
import {PmdEngine} from './lib/pmd/PmdEngine';
import {RuleManager} from './lib/RuleManager';
import {RulePathManager} from './lib/RulePathManager';
import LocalCatalog from './lib/services/LocalCatalog';
import {Config} from './lib/util/Config';

export const Services = {
	Config: "Config",
	RuleManager: "RuleManager",
	RuleEngine: "RuleEngine",
	RuleCatalog: "RuleCatalog",
	RulePathManager: "RulePathManager"
};

function registerAll() {
	container.registerSingleton(Services.Config, Config);
	container.registerSingleton(Services.RuleManager, DefaultRuleManager);
	container.registerSingleton(Services.RuleEngine, PmdEngine);
	container.registerSingleton(Services.RuleEngine, ESLintEngine);
	container.registerSingleton(Services.RuleCatalog, LocalCatalog);
	container.registerSingleton(Services.RulePathManager, CustomRulePathManager);
}

export const Controller = {
	container,
	reset: () => {
		container.reset();
		registerAll();
	},

	getConfig: async (): Promise<Config> => {
		const config = container.resolve<Config>(Services.Config);
		await config.init();
		return config;
	},

	createRuleManager: async (): Promise<RuleManager> => {
		const manager = container.resolve<RuleManager>(Services.RuleManager);
		await manager.init();
		return manager;
	},

	createRulePathManager: async (): Promise<RulePathManager> => {
		const manager = container.resolve<RulePathManager>(Services.RulePathManager);
		await manager.init();
		return manager;
	}
};

registerAll();
