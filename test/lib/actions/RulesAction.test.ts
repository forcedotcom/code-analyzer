import ansis from 'ansis';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { RulesAction, RulesDependencies, RulesInput } from '../../../src/lib/actions/RulesAction';
import { RulesActionSummaryViewer } from '../../../src/lib/viewers/ActionSummaryViewer';
import { DisplayEventType, SpyDisplay } from '../../stubs/SpyDisplay';
import { SpyRuleViewer } from '../../stubs/SpyRuleViewer';
import { SpyRuleWriter } from '../../stubs/SpyRuleWriter';
import { StubDefaultConfigFactory } from '../../stubs/StubCodeAnalyzerConfigFactories';
import * as StubEnginePluginFactories from '../../stubs/StubEnginePluginsFactories';
import { CapturedTelemetryEmission, SpyTelemetryEmitter } from '../../stubs/SpyTelemetryEmitter';

const PATH_TO_GOLDFILES = path.join(__dirname, '..', '..', 'fixtures', 'comparison-files', 'lib', 'actions', 'RulesAction.test.ts');

describe('RulesAction tests', () => {
	let viewer: SpyRuleViewer;
	let writer: SpyRuleWriter;
	let spyDisplay: SpyDisplay;
	let spyTelemetryEmitter: SpyTelemetryEmitter;
	let actionSummaryViewer: RulesActionSummaryViewer;
	let defaultDependencies: RulesDependencies;

	beforeEach(() => {
		viewer = new SpyRuleViewer();
		writer = new SpyRuleWriter();
		spyDisplay = new SpyDisplay();
		actionSummaryViewer = new RulesActionSummaryViewer(spyDisplay);
		spyTelemetryEmitter = new SpyTelemetryEmitter();
		defaultDependencies = {
			configFactory: new StubDefaultConfigFactory(),
			pluginsFactory: new StubEnginePluginFactories.StubEnginePluginsFactory_withFunctionalStubEngine(),
			logEventListeners: [],
			progressListeners: [],
			telemetryEmitter: spyTelemetryEmitter,
			actionSummaryViewer,
			viewer,
			writer
		};
	})

	it('Submitting the all-selector displays all rules', async () => {
		const action = RulesAction.createAction(defaultDependencies);
		const input: RulesInput = {
			'rule-selector': ['all']
		};

		await action.execute(input);

		const viewerCallHistory = viewer.getCallHistory();
		expect(viewerCallHistory).toHaveLength(1);
		expect(viewerCallHistory[0].map(rule => rule.getName())).toEqual([
			'stub1RuleA',
			'stub1RuleB',
			'stub1RuleC',
			'stub1RuleD',
			'stub1RuleE',
			'stub2RuleA',
			'stub2RuleB',
			'stub2RuleC'
		]);
		const writerCallHistory = writer.getCallHistory();
		expect(writerCallHistory).toHaveLength(1);
	});

	it('Submitting a filtering selector returns only matching rules', async () => {
		const action = RulesAction.createAction(defaultDependencies);
		const input: RulesInput = {
			'rule-selector': ['CodeStyle']
		};

		await action.execute(input);

		const viewerCallHistory = viewer.getCallHistory();
		expect(viewerCallHistory).toHaveLength(1);
		expect(viewerCallHistory[0].map(rule => rule.getName())).toEqual([
			'stub1RuleA',
			'stub1RuleD'
		]);
	});

	it('Writes output and views it with output file and view flag', async () => {
		const spyWriter: SpyRuleWriter = new SpyRuleWriter();
		defaultDependencies.writer = spyWriter;
		const action = RulesAction.createAction(defaultDependencies);
		const input: RulesInput = {
			'rule-selector': ['CodeStyle'],
			'output-file': ['selected-rules.json'],
			'view': 'detail'
		};

		await action.execute(input);

		const viewerCallHistory = viewer.getCallHistory();
		expect(viewerCallHistory).toHaveLength(1);

		const writerCallHistory = spyWriter.getCallHistory();
		expect(writerCallHistory).toHaveLength(1);
	});

	describe('Target/Workspace resolution', () => {
		const originalCwd: string = process.cwd();
		const baseDir: string = path.resolve(__dirname, '..', '..', '..');

		beforeEach(() => {
			process.chdir(baseDir);
		});

		afterEach(() => {
			process.chdir(originalCwd);
		})

		it.each([
			{
				case: 'a workspace narrows the applicable files',
				workspace: [path.join(baseDir, 'package.json'), path.join(baseDir, 'README.md')],
				target: undefined
			},
			{
				case: 'a target further narrows an explicitly defined workspace',
				workspace: ['.'],
				target: ['package.json', 'README.md']
			},
			{
				case: 'a target further narrows an implicitly defined workspace',
				workspace: undefined,
				target: ['package.json', 'README.md']
			}
		])('When $case, only the relevant rules are returned', async ({workspace, target}) => {
			const dependencies: RulesDependencies = {
				...defaultDependencies,
				pluginsFactory: new StubEnginePluginFactories.StubEnginePluginsFactory_withTargetDependentStubEngine(),
			};
			const action = RulesAction.createAction(dependencies);
			const input: RulesInput = {
				'rule-selector': ['Recommended'],
				workspace,
				target
			};

			await action.execute(input);

			const viewerCallHistory = viewer.getCallHistory();
			expect(viewerCallHistory).toHaveLength(1);
			const expectedFilesAndFolders = ['package.json', 'README.md'];
			const expectedRuleNames = expectedFilesAndFolders.map(t => `ruleFor${path.resolve(t)}`);
			const actualRuleNames = viewerCallHistory[0].map(rule => rule.getName());
			expect(actualRuleNames).toHaveLength(expectedRuleNames.length);
			// The rules' order might not exactly match the provided targets', but as long as they're all present, it's fine.
			for (const expectedRuleName of expectedRuleNames) {
				expect(actualRuleNames).toContain(expectedRuleName);
			}
		});
	});

	/**
	 * This behavior was not formally defined, and isn't actually possible at the moment due to
	 * hard-coded engines. But in the future we may want to have dynamic engine loading, and this
	 * test will help us do that.
	 */
	it('When no engines are registered, empty results are displayed', async () => {
		const dependencies: RulesDependencies = {
			...defaultDependencies,
			pluginsFactory: new StubEnginePluginFactories.StubEnginePluginsFactory_withNoPlugins(),
		};
		const action = RulesAction.createAction(dependencies);
		const input: RulesInput = {
			'rule-selector': ['all']
		};

		await action.execute(input);

		const viewerCallHistory = viewer.getCallHistory();
		expect(viewerCallHistory).toHaveLength(1);
		expect(viewerCallHistory[0]).toEqual([]);
	});

	it('Throws an error when an engine throws an error', async () => {
		const dependencies: RulesDependencies = {
			...defaultDependencies,
			pluginsFactory: new StubEnginePluginFactories.StubEnginePluginsFactory_withThrowingStubPlugin(),
		};
		const action = RulesAction.createAction(dependencies);
		const input: RulesInput = {
			'rule-selector': ['all']
		};
		const executionPromise = action.execute(input);

		await expect(executionPromise).rejects.toThrow('SomeErrorFromGetAvailableEngineNames');
	});

	describe('Summary generation', () => {
		const preExecutionGoldfilePath: string = path.join(PATH_TO_GOLDFILES, 'action-summaries', 'pre-execution-summary.txt.goldfile');
		let viewer: SpyRuleViewer;

		beforeEach(() => {
			viewer = new SpyRuleViewer();
		})

		it.each([
			{quantifier: 'no', expectation: 'Summary indicates absence of rules', selector: 'NonsensicalTag', goldfile: 'no-rules.txt.goldfile'},
			{quantifier: 'some', expectation: 'Summary provides breakdown by engine', selector: 'Recommended', goldfile: 'some-rules.txt.goldfile'}
		])('When $quantifier rules are returned, $expectation', async ({selector, goldfile}) => {
			const goldfilePath: string = path.join(PATH_TO_GOLDFILES, 'action-summaries', goldfile);
			const dependencies: RulesDependencies = {
				...defaultDependencies,
				pluginsFactory: new StubEnginePluginFactories.StubEnginePluginsFactory_withFunctionalStubEngine(),
				viewer
			};
			const action = RulesAction.createAction(dependencies);
			const input: RulesInput = {
				'rule-selector': [selector]
			};

			await action.execute(input);

			const displayEvents = spyDisplay.getDisplayEvents();
			const displayedLogEvents = ansis.strip(displayEvents
				.filter(e => e.type === DisplayEventType.LOG)
				.map(e => e.data)
				.join('\n'));
			const preExecutionGoldfileContents: string = await fsp.readFile(preExecutionGoldfilePath, 'utf-8');
			expect(displayedLogEvents).toContain(preExecutionGoldfileContents);

			const goldfileContents: string = await fsp.readFile(goldfilePath, 'utf-8');
			expect(displayedLogEvents).toContain(goldfileContents);
		});

		it('Mentions an outfile in summary if provided', async () => {
			const outfilePath = path.join('the', 'results.json');
			const spyWriter: SpyRuleWriter = new SpyRuleWriter();
			const summaryGoldfilePath: string = path.join(PATH_TO_GOLDFILES, 'action-summaries', 'rules-with-outfile.txt.goldfile');
			defaultDependencies.writer = spyWriter;
			const action = RulesAction.createAction(defaultDependencies);
			const input: RulesInput = {
				'rule-selector': ['Codestyle'],
				'output-file': [outfilePath]
			};

			await action.execute(input);

			const preExecutionGoldfileContents: string = await fsp.readFile(preExecutionGoldfilePath, 'utf-8');
			const goldfileContents: string = (await fsp.readFile(summaryGoldfilePath, 'utf-8'))
				.replace(`{{PATH_TO_FILE}}`, outfilePath);
			const displayEvents = spyDisplay.getDisplayEvents();
			const displayedLogEvents = ansis.strip(displayEvents
				.filter(e => e.type === DisplayEventType.LOG)
				.map(e => e.data)
				.join('\n'));
			expect(displayedLogEvents).toContain(preExecutionGoldfileContents);
			expect(displayedLogEvents).toContain(goldfileContents);
		});
	});

	describe('Telemetry Emission', () => {
			it('When a telemetry emitter is provided, it is used', async () => {

				defaultDependencies.pluginsFactory = new StubEnginePluginFactories.StubEnginePluginsFactory_withFunctionalStubEngine();
				const action = RulesAction.createAction(defaultDependencies);
				// Create the input.
				const input: RulesInput = {
					'rule-selector': ['all']
				};
				// ==== TESTED BEHAVIOR ====
				await action.execute(input);
	
				const telemEvents: CapturedTelemetryEmission[] = spyTelemetryEmitter.getCapturedTelemetry()
					.filter(e => e.data.sfcaEvent === 'engine_selection');

				// ==== ASSERTIONS ====
				expect(telemEvents).toHaveLength(2);
				expect(telemEvents[0]).toEqual({
					"data": {
						"engine": "stubEngine1",
						"ruleCount": 5,
						"sfcaEvent": "engine_selection"
					},
					"eventName": "plugin-code-analyzer",
					"source": "CLI"
				});
				expect(telemEvents[1]).toEqual({
					"data": {
						"engine": "stubEngine2",
						"ruleCount": 3,
						"sfcaEvent": "engine_selection"
					},
					"eventName": "plugin-code-analyzer",
					"source": "CLI"
				});
			});
		})
});

// TODO: Whenever we decide to document the custom_engine_plugin_modules flag in our configuration file, then we'll want
// to add in tests to lock in that behavior. But for now, it is a hidden utility for us to use internally, so no tests
// have been added.
