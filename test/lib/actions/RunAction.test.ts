import * as path from 'node:path';
import * as fs from 'node:fs';
import ansis from 'ansis';
import {SfError} from '@salesforce/core';
import {SeverityLevel} from '@salesforce/code-analyzer-core';
import {SpyResultsViewer} from '../../stubs/SpyResultsViewer.js';
import {SpyResultsWriter} from '../../stubs/SpyResultsWriter.js';
import {SpyDisplay, DisplayEventType} from '../../stubs/SpyDisplay.js';
import {StubDefaultConfigFactory} from '../../stubs/StubCodeAnalyzerConfigFactories.js';
import {ConfigurableStubEnginePlugin1, StubEngine1, TargetDependentEngine1} from '../../stubs/StubEnginePlugins.js';
import {RunAction, RunInput, RunDependencies} from '../../../src/lib/actions/RunAction.js';
import {RunActionSummaryViewer} from '../../../src/lib/viewers/ActionSummaryViewer.js';
import {
	StubEnginePluginsFactory_withPreconfiguredStubEngines,
	StubEnginePluginsFactory_withThrowingStubPlugin
} from '../../stubs/StubEnginePluginsFactories.js';
import {SpyTelemetryEmitter} from '../../stubs/SpyTelemetryEmitter.js';

const PATH_TO_FILE_A = path.resolve('test', 'sample-code', 'fileA.cls');
const PATH_TO_GOLDFILES = path.join(import.meta.dirname, '..', '..', 'fixtures', 'comparison-files', 'lib', 'actions', 'RunAction.test.ts');

describe('RunAction tests', () => {
	let spyDisplay: SpyDisplay;
	let engine1: StubEngine1;
	let stubEnginePlugin: ConfigurableStubEnginePlugin1;
	let pluginsFactory: StubEnginePluginsFactory_withPreconfiguredStubEngines;
	let writer: SpyResultsWriter;
	let resultsViewer: SpyResultsViewer;
	let actionSummaryViewer: RunActionSummaryViewer;
	let dependencies: RunDependencies;
	let action: RunAction;

	beforeEach(() => {
		// Set up the engine, plugin, and factory.
		engine1 = new StubEngine1({});
		stubEnginePlugin = new ConfigurableStubEnginePlugin1();
		stubEnginePlugin.addEngine(engine1);
		pluginsFactory = new StubEnginePluginsFactory_withPreconfiguredStubEngines();
		pluginsFactory.addPreconfiguredEnginePlugin(stubEnginePlugin);

		// Set up the writer and viewers.
		spyDisplay = new SpyDisplay();
		writer = new SpyResultsWriter();
		resultsViewer = new SpyResultsViewer();
		actionSummaryViewer = new RunActionSummaryViewer(spyDisplay);

		// Initialize our dependency object.
		dependencies = {
			configFactory: new StubDefaultConfigFactory(),
			pluginsFactory: pluginsFactory,
			logEventListeners: [],
			progressListeners: [],
			telemetryEmitter: new SpyTelemetryEmitter(),
			writer,
			resultsViewer,
			actionSummaryViewer
		};
		// Create the action.
		action = RunAction.createAction(dependencies);
	});

	it.each([
		{selector: 'all', expectedRules: ['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']},
		{selector: 'recommended', expectedRules: ['stub1RuleA', 'stub1RuleB', 'stub1RuleC']},
		{selector: 'security', expectedRules: ['stub1RuleB']}
	])('Accepts and runs rule selector: "$selector"', async ({selector, expectedRules}) => {
		// ==== SETUP ====
		// Create the input.
		const input: RunInput = {
			// Use the selector provided by the test
			'rule-selector': [selector],
			// Use the current directory, for convenience.
			'workspace': ['.'],
			// Outfiles can just be an empty list.
			'output-file': []
		};
		// Configure the engine to return a violation for the first expected rule.
		engine1.resultsToReturn = {
			violations: [{
				ruleName: expectedRules[0],
				message: 'Fake message',
				codeLocations: [{
					file: PATH_TO_FILE_A,
					startLine: 5,
					startColumn: 1
				}],
				primaryLocationIndex: 0
			}]
		};

		// ==== TESTED BEHAVIOR ====
		await action.execute(input);

		// ==== ASSERTIONS ====
		// Verify that the expected rules were executed on the right files.
		const actualExecutedRules = engine1.runRulesCallHistory[0].ruleNames;
		expect(actualExecutedRules).toEqual(expectedRules);
		const actualTargetFiles = engine1.runRulesCallHistory[0].runOptions.workspace.getRawFilesAndFolders();
		expect(actualTargetFiles).toEqual([path.resolve('.')]);
		// Verify that the expected results were passed into the Viewer and Writer.
		expect(writer.getCallHistory()[0].getViolationCount()).toEqual(1);
		expect(writer.getCallHistory()[0].getViolations()[0].getMessage()).toEqual('Fake message');
		expect(resultsViewer.getCallHistory()[0].getViolationCount()).toEqual(1);
		expect(resultsViewer.getCallHistory()[0].getViolations()[0].getMessage()).toEqual('Fake message');
	});

	it.each([
		{
			case: 'Workspace only',
			workspace: ['package.json', 'README.md'],
			target: undefined
		},
		{
			case: 'Workspace and Targets',
			workspace: ['.'],
			target: ['package.json', 'README.md']
		}
	])('Engines with target-dependent rules run the right rules. Case: $case', async ({workspace, target}) => {
		// ==== SETUP ====
		// Add a target-dependent engine to the engines that will be run.
		const targetDependentEngine: TargetDependentEngine1 = new TargetDependentEngine1({});
		stubEnginePlugin.addEngine(targetDependentEngine);
		// Create the input
		const input: RunInput = {
			// Select only rules in the target-dependent engine.
			"rule-selector": [targetDependentEngine.getName()],
			workspace,
			target,
			'output-file': []
		};

		// ==== TESTED BEHAVIOR ====
		await action.execute(input);

		// ==== ASSERTIONS ====
		// No rules in the shared stub engine should have been run.
		expect(engine1.runRulesCallHistory).toHaveLength(0);
		const actualExecutedRules = targetDependentEngine.runRulesCallHistory[0].ruleNames;
		// One rule per target should have been run in the target-dependent engine.
		const expectedTargetFiles = ['package.json', 'README.md'];
		expect(actualExecutedRules).toHaveLength(expectedTargetFiles.length);
		const expectedRuleNames = expectedTargetFiles.map(t => `ruleFor${path.resolve(t)}`);
		// The rules' order might not exactly match the provided targets', but as long as they're all present, it's fine.
		for (const expectedRuleName of expectedRuleNames) {
			expect(actualExecutedRules).toContain(expectedRuleName);
		}
	});

	it.each([
		{type: 'exceeded', sev: SeverityLevel.Moderate},
		{type: 'met', sev: SeverityLevel.High}
	])('When severity threshold is $type, an error is thrown', async ({sev}) => {
		// ==== SETUP ====
		// Create the input.
		const input: RunInput = {
			// Use the test-specific severity.
			'severity-threshold': sev,
			// Use 'all' to select all rules.
			'rule-selector': ['all'],
			// Use the current directory, for convenience.
			'workspace': ['.'],
			'output-file': []
		};
		// Configure the engine to return a violation for a rule with a known severity.
		engine1.resultsToReturn = {
			violations: [{
				ruleName: 'stub1RuleB',
				message: 'Fake message',
				codeLocations: [{
					file: PATH_TO_FILE_A,
					startLine: 5,
					startColumn: 1
				}],
				primaryLocationIndex: 0
			}]
		};

		// ==== TESTED BEHAVIOR ====
		// Typically we'd use Jest's `expect().toThrow()` method, but since we need to assert specific things
		// about the error, we're doing this instead.
		let thrownError: Error|null = null;
		try {
			await action.execute(input);
		} catch (e) {
			thrownError = e;
		}
		expect(thrownError).toBeInstanceOf(SfError);
		expect((thrownError as SfError).message).toContain(SeverityLevel[sev]);
		expect((thrownError as SfError).exitCode).toEqual(SeverityLevel.High);
	});

	it('When severity threshold is NOT met, an error is not thrown', async () => {
		// ==== SETUP ====
		// Create the input.
		const input: RunInput = {
			// Specify a severity HIGHER than that of the known rule.
			'severity-threshold': SeverityLevel.Critical,
			// Use 'all' to select all rules.
			'rule-selector': ['all'],
			// Use the current directory, for convenience.
			'workspace': ['.'],
			'output-file': []
		};
		// Configure the engine to return a violation for a rule with a known severity.
		engine1.resultsToReturn = {
			violations: [{
				ruleName: 'stub1RuleC',
				message: 'Fake message',
				codeLocations: [{
					file: PATH_TO_FILE_A,
					startLine: 5,
					startColumn: 1
				}],
				primaryLocationIndex: 0
			}]
		};

		// ==== TESTED BEHAVIOR ====
		const executionPromise = action.execute(input);

		// ==== ASSERTIONS ====
		await expect(executionPromise).resolves.not.toThrow();
	});

	it('Throws an error when an engine cannot be initialized', async () => {
		// ==== SETUP ====
		// Create our dependencies, intentionally using a different object than the one set up in
		// the before-each.
		const dependencies: RunDependencies = {
			configFactory: new StubDefaultConfigFactory(),
			// Use an engine plugin factory that returns an engine guaranteed to fail during initialization
			pluginsFactory: new StubEnginePluginsFactory_withThrowingStubPlugin(),
			logEventListeners: [],
			progressListeners: [],
			telemetryEmitter: new SpyTelemetryEmitter(),
			writer,
			resultsViewer,
			actionSummaryViewer
		};
		// Instantiate our action, intentionally using a different instance than the one set up in
		// the before-each.
		const action = RunAction.createAction(dependencies);
		const input: RunInput = {
			'rule-selector': ['all'],
			'workspace': ['.'],
			'output-file': []
		};

		// ==== TESTED BEHAVIOR ====
		const executionPromise =  action.execute(input);

		// ==== ASSERTIONS ====
		await expect(executionPromise).rejects.toThrow('SomeErrorFromGetAvailableEngineNames');
	});

	describe('Summary generation', () => {
		it.each([
			{quantifier: 'no', expectation: 'Summarizer reflects this fact', goldfile: 'no-violations.txt.goldfile', resultsToReturn: []},
			{quantifier: 'some', expectation: 'Summarizer breaks them down by severity', goldfile: 'some-violations.txt.goldfile',
				resultsToReturn: [{
					ruleName: 'stub1RuleA',
					message: 'Fake message',
					codeLocations: [{
						file: PATH_TO_FILE_A,
						startLine: 5,
						startColumn: 1
					}],
					primaryLocationIndex: 0
				}, {
					ruleName: 'stub1RuleB',
					message: 'Fake message',
					codeLocations: [{
						file: PATH_TO_FILE_A,
						startLine: 5,
						startColumn: 1
					}],
					primaryLocationIndex: 0
				}]
			}
		])('When $quantifier violations are found, $expectation', async ({resultsToReturn, goldfile}) => {
			// ==== SETUP ====
			const expectedRules = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']
			// Create the input.
			const input: RunInput = {
				// Use the selector provided by the test
				'rule-selector': ['all'],
				// Use the current directory, for convenience.
				'workspace': ['.'],
				// Outfile is just an empty list
				'output-file': []
			};
			// Configure the engine to return a violation for the first expected rule.
			engine1.resultsToReturn = {
				violations: resultsToReturn
			};

			// ==== TESTED BEHAVIOR ====
			await action.execute(input);

			// ==== ASSERTIONS ====
			// Verify that the expected rules were executed on the right files.
			const actualExecutedRules = engine1.runRulesCallHistory[0].ruleNames;
			expect(actualExecutedRules).toEqual(expectedRules);
			const actualTargetFiles = engine1.runRulesCallHistory[0].runOptions.workspace.getRawFilesAndFolders();
			expect(actualTargetFiles).toEqual([path.resolve('.')]);
			// Verify that the summary output matches the expectation.
			const preExecutionGoldfileContents: string = await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, 'action-summaries', 'pre-execution-summary.txt.goldfile'), 'utf-8');
			const goldfileContents: string = await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, 'action-summaries', goldfile), 'utf-8');
			const displayEvents = spyDisplay.getDisplayEvents();
			const displayedLogEvents = ansis.strip(displayEvents
				.filter(e => e.type === DisplayEventType.LOG)
				.map(e => e.data)
				.join('\n'));
			expect(displayedLogEvents).toContain(preExecutionGoldfileContents);
			expect(displayedLogEvents).toContain(goldfileContents);
		});

		it('When Outfiles are provided, they are mentioned', async () => {
			// ==== SETUP ====
			const expectedRules = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']
			const outfilePath1 = path.join('the', 'specifics', 'of', 'this', 'path', 'do', 'not', 'matter.csv');
			const outfilePath2 = path.join('neither', 'do', 'the', 'specifics', 'of', 'this', 'one.json');
			// Create the input.
			const input: RunInput = {
				// Use the selector provided by the test
				'rule-selector': ['all'],
				// Use the current directory, for convenience.
				'workspace': ['.'],
				// Outfiles are provided
				'output-file': [outfilePath1, outfilePath2]
			};
			// Configure the engine to return a violation for the first expected rule.
			engine1.resultsToReturn = {
				violations: [{
					ruleName: 'stub1RuleA',
					message: 'Fake message',
					codeLocations: [{
						file: PATH_TO_FILE_A,
						startLine: 5,
						startColumn: 1
					}],
					primaryLocationIndex: 0
				}]
			};

			// ==== TESTED BEHAVIOR ====
			await action.execute(input);

			// ==== ASSERTIONS ====
			// Verify that the expected rules were executed on the right files.
			const actualExecutedRules = engine1.runRulesCallHistory[0].ruleNames;
			expect(actualExecutedRules).toEqual(expectedRules);
			const actualTargetFiles = engine1.runRulesCallHistory[0].runOptions.workspace.getRawFilesAndFolders();
			expect(actualTargetFiles).toEqual([path.resolve('.')]);
			// Verify that the summary output matches the expectation.
			const preExecutionGoldfileContents: string = await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, 'action-summaries', 'pre-execution-summary.txt.goldfile'), 'utf-8');
			const goldfileContents: string = (await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, 'action-summaries', 'some-outfiles.txt.goldfile'), 'utf-8'))
				.replace(`{{PATH_TO_FILE1}}`, outfilePath1)
				.replace(`{{PATH_TO_FILE2}}`, outfilePath2);
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
			// ==== SETUP ====
			// Create a telemetry emitter and set it to be used.
			const spyTelemetryEmitter: SpyTelemetryEmitter = new SpyTelemetryEmitter();
			dependencies.telemetryEmitter = spyTelemetryEmitter;
			// Create the input.
			const input: RunInput = {
				// Select all rules.
				'rule-selector': ['all'],
				// Use the current directory, for convenience.
				'workspace': ['.'],
				// Outfiles can just be an empty list.
				'output-file': []
			};
			// ==== TESTED BEHAVIOR ====
			await action.execute(input);

			// ==== ASSERTIONS ====
			expect(spyTelemetryEmitter.getCapturedTelemetry()).toHaveLength(4);

			expect(spyTelemetryEmitter.getCapturedTelemetry()[0].eventName).toEqual('plugin-code-analyzer');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[0].source).toEqual('stubEngine1');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[0].data.sfcaEvent).toEqual('engine1DescribeTelemetry');

			expect(spyTelemetryEmitter.getCapturedTelemetry()[1].eventName).toEqual('plugin-code-analyzer');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[1].source).toEqual('stubEngine1');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[1].data.sfcaEvent).toEqual('engine1ExecuteTelemetry');

			expect(spyTelemetryEmitter.getCapturedTelemetry()[2].eventName).toEqual('plugin-code-analyzer');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[2].source).toEqual('CLI');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[2].data.sfcaEvent).toEqual('engine_selection');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[2].data.ruleCount).toEqual(5);

			expect(spyTelemetryEmitter.getCapturedTelemetry()[3].eventName).toEqual('plugin-code-analyzer');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[3].source).toEqual('CLI');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[3].data.sfcaEvent).toEqual('engine_execution');
			expect(spyTelemetryEmitter.getCapturedTelemetry()[3].data.violationCount).toEqual(0);
		});
	})
});

// TODO: Whenever we decide to document the custom_engine_plugin_modules flag in our configuration file, then we'll want
// to add in tests to lock in that behavior. But for now, it is a hidden utility for us to use internally, so no tests
// have been added.
