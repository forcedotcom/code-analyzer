import * as path from 'node:path';
import {CodeAnalyzer, CodeAnalyzerConfig, EventType, LogEvent, LogLevel} from '@salesforce/code-analyzer-core';
import {EnginePluginsFactoryImpl} from '../../../src/lib/factories/EnginePluginsFactory.js';

const WORKSPACE_WITH_FLOW = path.resolve(import.meta.dirname, '..', '..', 'fixtures', 'example-workspaces', 'workspace-with-flow');

describe('EnginePluginsFactoryImpl', () => {
	it('Loads expected engines', () => {
		const pluginsFactory = new EnginePluginsFactoryImpl();
		const enginePlugins = pluginsFactory.create();

		expect(enginePlugins).toHaveLength(9);
		expect(enginePlugins[0].getAvailableEngineNames()).toEqual(['eslint']);
		expect(enginePlugins[1].getAvailableEngineNames()).toEqual(['pmd', 'cpd']);
		expect(enginePlugins[2].getAvailableEngineNames()).toEqual(['retire-js']);
		expect(enginePlugins[3].getAvailableEngineNames()).toEqual(['regex']);
		expect(enginePlugins[4].getAvailableEngineNames()).toEqual(['flow']);
		expect(enginePlugins[5].getAvailableEngineNames()).toEqual(['sfge']);
		expect(enginePlugins[6].getAvailableEngineNames()).toEqual(['apexguru']);
		expect(enginePlugins[7].getAvailableEngineNames()).toEqual(['uibundle']);
		expect(enginePlugins[8].getAvailableEngineNames()).toEqual(['flow-analyzer']);
	});

	describe('flow-analyzer without a target org', () => {
		let core: CodeAnalyzer;
		let errorLogs: LogEvent[];

		beforeEach(async () => {
			core = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
			errorLogs = [];
			core.onEvent(EventType.LogEvent, (event: LogEvent) => {
				if (event.logLevel <= LogLevel.Warn) {
					errorLogs.push(event);
				}
			});
			// Only load the lightweight regex engine alongside flow-analyzer to keep this test fast.
			const plugins = new EnginePluginsFactoryImpl().create().filter(p => {
				const names = p.getAvailableEngineNames();
				return names.includes('regex') || names.includes('flow-analyzer');
			});
			for (const plugin of plugins) {
				await core.addEnginePlugin(plugin);
			}
		});

		it('does not break unrelated scans', async () => {
			const workspace = await core.createWorkspace([WORKSPACE_WITH_FLOW]);
			const ruleSelection = await core.selectRules(['regex'], {workspace});
			const results = await core.run(ruleSelection, {workspace});

			expect(core.getEngineNames()).toContain('flow-analyzer');
			expect(results.getViolations().filter(v => v.getRule().getEngineName() === 'flow-analyzer')).toEqual([]);
			expect(errorLogs).toEqual([]);
		});

		it('offers no rules instead of an engine error', async () => {
			const workspace = await core.createWorkspace([WORKSPACE_WITH_FLOW]);
			const ruleSelection = await core.selectRules(['flow-analyzer'], {workspace});

			expect(ruleSelection.getCount()).toEqual(0);
			expect(errorLogs).toEqual([]);
		});
	});
});
