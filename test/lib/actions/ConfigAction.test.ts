import path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as fsp from 'node:fs/promises';
import ansis from 'ansis';
import {CodeAnalyzerConfig} from "@salesforce/code-analyzer-core";
import * as EngineApi from "@salesforce/code-analyzer-engine-api";

import {CodeAnalyzerConfigFactory} from "../../../src/lib/factories/CodeAnalyzerConfigFactory";
import {EnginePluginsFactory} from '../../../src/lib/factories/EnginePluginsFactory';
import {ConfigAction, ConfigDependencies, ConfigInput} from '../../../src/lib/actions/ConfigAction';
import {ConfigStyledYamlViewer} from '../../../src/lib/viewers/ConfigViewer';
import {ConfigActionSummaryViewer} from '../../../src/lib/viewers/ActionSummaryViewer';

import {SpyConfigWriter} from '../../stubs/SpyConfigWriter';
import {SpyConfigViewer} from '../../stubs/SpyConfigViewer';
import {DisplayEvent, DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay';
import { LogEventDisplayer } from '../../../src/lib/listeners/LogEventListener';

const PATH_TO_FIXTURES = path.join(__dirname, '..', '..', 'fixtures');

const PATH_TO_EXAMPLE_WORKSPACE = path.join(PATH_TO_FIXTURES, 'example-workspaces', 'ConfigAction.test.ts');

describe('ConfigAction tests', () => {
	const PATH_TO_COMPARISON_DIR = path.join(PATH_TO_FIXTURES, 'comparison-files', 'lib', 'actions', 'ConfigAction.test.ts');

	let spyDisplay: SpyDisplay;
	let dependencies: ConfigDependencies;

	describe('Config Resolution', () => {

		describe('When there IS NOT an existing config...', () => {

			beforeEach(() => {
				spyDisplay = new SpyDisplay();
				dependencies = {
					logEventListeners: [new LogEventDisplayer(spyDisplay)],
					progressEventListeners: [],
					viewer: new ConfigStyledYamlViewer(spyDisplay),
					configFactory: new StubCodeAnalyzerConfigFactory(),
					actionSummaryViewer: new ConfigActionSummaryViewer(spyDisplay),
					pluginsFactory: new StubEnginePluginFactory()
				};
			});

			it.each([
				{position: 'start'},
				{position: 'end'}
			])('Top-level $position comment is correct', async ({position}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'header-comments', `top-level-${position}.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{section: 'config_root'},
				{section: 'log_folder'},
				{section: 'log_level'},
				{section: 'rules'},
				{section: 'engines'}
			])('`$section` section header-comment is correct', async ({section}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'header-comments', `${section}-section.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{prop: 'config_root'},
				{prop: 'log_folder'}
			])('Derivable property $prop is null, and derived value is in a comment', async ({prop}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const defaultConfig = CodeAnalyzerConfig.withDefaults();
				const goldFileContents = (await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'derivables-as-defaults', `${prop}.yml.goldfile`)))
					.replaceAll('__DUMMY_CONFIG_ROOT__', JSON.stringify(defaultConfig.getConfigRoot()))
					.replaceAll('__DUMMY_LOG_FOLDER__', JSON.stringify(defaultConfig.getLogFolder()));
				expect(output).toContain(goldFileContents);
			});

			it('When not including unmodified rules, then selected rules are not present', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the rules with the CodeStyle tag
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				const unExpectedStub1RuleOverrideText: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'default-configurations', 'Stub1Rule1.yml.goldfile'));
				expect(output).not.toContain(unExpectedStub1RuleOverrideText);
				const expectedRuleOverrideText: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'default-configurations', 'rulesSectionWithNoModifications.yml.goldfile'));
				expect(output).toContain(expectedRuleOverrideText);
			});

			it('When including unmodified rules, then selected rules are present and uncommented', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the rules with the CodeStyle tag
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle'], undefined, undefined, undefined, true);

				// ==== ASSERTIONS ====
				// Rather than exhaustively check every rule, we'll just check one, because if that one is correct then
				// we can reasonably assume that the other rules are also present and correct.
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'default-configurations', 'Stub1Rule1.yml.goldfile'));
				expect(output).toContain(goldFileContents);
			});

			it('Unselected rules are absent', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the rules with the CodeStyle tag
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				// Rather than exhaustively check every rule, we'll just check one, because if that rule is properly
				// absent then we can reasonably assume that the other ones are too.
				expect(output).not.toContain('Stub1Rule3');
			});

			it('Engines for selected rules use their default configuration', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the rules with the CodeStyle tag
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				// Only one engine has rules that got returned.
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'default-configurations', 'StubEngine1.yml.goldfile'));
				expect(output).toContain(goldFileContents);
			});

			it('Engines for unselected rules have no configuration', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the rules with the CodeStyle tag
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				// StubEngine2 has no rules with the CodeStyle tag.
				expect(output).not.toContain('StubEngine2');
			});

			it('Edge case: When no rules are selected, `rules` and `engines` sections are commented empty objects', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select the tag "NoRuleHasThisTag"
				const output = await runActionAndGetDisplayedConfig(dependencies, ['NoRuleHasThisTag']);

				// ==== ASSERTIONS ====
				expect(output).toContain('rules: {} # Empty object used because rule selection returned no rules');
				expect(output).toContain('engines: {} # Empty object used because rule selection returned no rules');
			});

			it('Edge case: When including unmodified rules and a selected rule has no tags by default, `tags` is an empty array with no comment', async () => {
				// ==== TESTED BEHAVIOR ====
				// Select Stub1Rule7, which has no tags, by its name directly.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['Stub1Rule7'], undefined, undefined, undefined, true);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'default-configurations', 'Stub1Rule7.yml.goldfile'));
				expect(output).toContain(goldFileContents);
			});
		});

		describe('When there IS an existing config...', () => {

			let stubConfigFactory: AlternativeStubCodeAnalyzerConfigFactory;

			beforeEach(() => {
				stubConfigFactory = new AlternativeStubCodeAnalyzerConfigFactory();
				spyDisplay = new SpyDisplay();
				dependencies = {
					logEventListeners: [new LogEventDisplayer(spyDisplay)],
					progressEventListeners: [],
					viewer: new ConfigStyledYamlViewer(spyDisplay),
					configFactory: stubConfigFactory,
					actionSummaryViewer: new ConfigActionSummaryViewer(spyDisplay),
					pluginsFactory: new StubEnginePluginFactory()
				};
			});


			it.each([
				{position: 'start'},
				{position: 'end'}
			])('Top-level $position comment is correct', async ({position}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'header-comments', `top-level-${position}.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{section: 'config_root'},
				{section: 'log_folder'},
				{section: 'log_level'},
				{section: 'rules'},
				{section: 'engines'}
			])('`$section` section header-comment is correct', async ({section}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'header-comments', `${section}-section.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{prop: 'config_root'},
				{prop: 'log_folder'}
			])('If derivable property $prop is explicitly null, then output is null and derived value is in a comment', async ({prop}) => {
				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const defaultConfig = CodeAnalyzerConfig.withDefaults();
				const goldFileContents = (await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'derivables-as-defaults', `${prop}.yml.goldfile`)))
					.replaceAll('__DUMMY_CONFIG_ROOT__', JSON.stringify(defaultConfig.getConfigRoot()))
					.replaceAll('__DUMMY_LOG_FOLDER__', JSON.stringify(defaultConfig.getLogFolder()));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{prop: 'config_root'},
				{prop: 'log_folder'}
			])('If derivable property $prop is explicitly its default value, then output is null and derived value is in a comment', async ({prop}) => {
				// ==== SETUP ====
				stubConfigFactory.dummyConfigRoot =CodeAnalyzerConfig.withDefaults().getConfigRoot();
				stubConfigFactory.dummyLogFolder = CodeAnalyzerConfig.withDefaults().getLogFolder();

				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const defaultConfig = CodeAnalyzerConfig.withDefaults();
				const goldFileContents = (await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'derivables-as-defaults', `${prop}.yml.goldfile`)))
					.replaceAll('__DUMMY_CONFIG_ROOT__', JSON.stringify(defaultConfig.getConfigRoot()))
					.replaceAll('__DUMMY_LOG_FOLDER__', JSON.stringify(defaultConfig.getLogFolder()));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{prop: 'config_root'},
				{prop: 'log_folder'}
			])(`When derivable property $prop input is non-null and non-default, it is rendered as-is`, async ({prop}) => {
				// ==== SETUP ====
				// Make the config root and log folder both a non-default temp folder
				const nonDefaultFolder: string = fs.mkdtempSync(path.join(os.tmpdir(), 'my-temp-'));
				stubConfigFactory.dummyConfigRoot = nonDefaultFolder;
				stubConfigFactory.dummyLogFolder = nonDefaultFolder;

				// ==== TESTED BEHAVIOR ====
				// Just select all rules for this test, since we don't care about the rules here.
				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				// ==== ASSERTIONS ====
				const goldFileContents = (await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'derivables-as-non-defaults', `${prop}.yml.goldfile`)))
					.replace('__DUMMY_CONFIG_ROOT__', nonDefaultFolder)
					.replace('__DUMMY_LOG_FOLDER__', nonDefaultFolder)
					.replace('__DUMMY_DEFAULT_CONFIG_ROOT__', 'null')
					.replace('__DUMMY_DEFAULT_LOG_FOLDER__', 'null')
				expect(output).toContain(goldFileContents);
			});

			it('When using non-default logLevel, it shows the change', async () => {
				// ==== SETUP ====
				dependencies.configFactory = new StubCodeAnalyzerConfigFactory(CodeAnalyzerConfig.fromObject({
					log_level: "warn"
				}));

				const output = await runActionAndGetDisplayedConfig(dependencies, ['all']);

				expect(output).toContain('log_level: 2 # Modified from: 4');
			});

			it.each([
				{overrideStatus: 'overridden tags', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule1'},
				{overrideStatus: 'overridden severity', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule2'},
				{overrideStatus: 'overridden tags and severity', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule3'},
				{overrideStatus: 'no overrides', commentStatus: 'no comment', ruleName: 'Stub1Rule4'},
			])('When including unmodified rule settings, selected and enabled rules with $overrideStatus are present with $commentStatus', async ({ruleName}) => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle'], undefined, undefined, undefined, true);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations', `${ruleName}.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{overrideStatus: 'overridden tags', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule1'},
				{overrideStatus: 'overridden severity', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule2'},
				{overrideStatus: 'overridden tags and severity', commentStatus: 'comment indicating original values', ruleName: 'Stub1Rule3'}
			])('When not including unmodified rule settings, selected and enabled rules with $overrideStatus are present with $commentStatus', async ({ruleName}) => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations-only-modifications', `${ruleName}.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it.each([
				{ruleType: 'Overridden and unselected rules', ruleName: 'Stub1Rule5'},
				{ruleType: 'Non-overridden and unselected rules', ruleName: 'Stub1Rule6'},
				{ruleType: 'Selected rules on disabled engines', ruleName: 'Stub3Rule1'},
			])('$ruleType are absent', async ({ruleName}) => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				expect(output).not.toContain(ruleName);
			});

			it('Engines for selected rules use their existing configuration', async () => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations', `StubEngine1.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it('Engines for unselected rules have no configuration', async () => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				expect(output).not.toContain('StubEngine2');
			});

			it('Disabled engines with selected rules use their configuration', async () => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['CodeStyle']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations', `StubEngine3.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it('Edge Case: When all engines are enabled and no rules are selected, `rules` and `engines` sections are commented empty objects', async () => {
				stubConfigFactory.stub3DisableEngineValue = false;

				// ==== TESTED BEHAVIOR ====
				// Select the tag "NoRuleHasThisTag"
				const output = await runActionAndGetDisplayedConfig(dependencies, ['NoRuleHasThisTag']);

				// ==== ASSERTIONS ====
				expect(output).toContain('rules: {} # Empty object used because rule selection returned no rules');
				expect(output).toContain('engines: {} # Empty object used because rule selection returned no rules');
			});

			it('Edge Case: When an engine is disabled and no rules are selected, `rules` is empty but `engines` still contains the disable_engine flag', async () => {
				// ==== SETUP ====
				stubConfigFactory.stub3DisableEngineValue = true;

				// ==== TESTED BEHAVIOR ====
				// Select the tag "NoRuleHasThisTag"
				const output = await runActionAndGetDisplayedConfig(dependencies, ['NoRuleHasThisTag']);

				// ==== ASSERTIONS ====
				expect(output).toContain('rules: {} # Empty object used because rule selection returned no rules');
				expect(output).toContain('disable_engine: true # Modified from: false');
			});

			it('Edge Case: When plugin throws error when attempting to create engine config but engine is disabled, then do not error', async () => {
				dependencies.pluginsFactory = new FactoryForThrowingEnginePlugin();
				dependencies.configFactory = new StubCodeAnalyzerConfigFactory(CodeAnalyzerConfig.fromObject({
					engines: {
						uncreatableEngine: {
							disable_engine: true,
							someField: 'some non default value'
						}
					}
				}));

				const output: string = await runActionAndGetDisplayedConfig(dependencies, ['NoRuleHasThisTag']);

				expect(spyDisplay.getDisplayEvents().filter(e => e.type == DisplayEventType.ERROR)).toHaveLength(0);

				expect(output).toContain('disable_engine: true # Modified from: false');
				expect(output).toContain('someField: some non default value # Modified from: "someDefault"');
			});

			it('Edge Case: When plugin throws error when attempting to create engine config, but engine is enabled, then issue error log but continue with whatever is in the users config for that engine', async () => {
				dependencies.pluginsFactory = new FactoryForThrowingEnginePlugin();
				dependencies.configFactory = new StubCodeAnalyzerConfigFactory(CodeAnalyzerConfig.fromObject({
					engines: {
						uncreatableEngine: {
							disable_engine: false,
							someField: 'some non default value'
						}
					}
				}));

				const output: string = await runActionAndGetDisplayedConfig(dependencies, ['uncreatableEngine']);

				const errorEvents: DisplayEvent[] = spyDisplay.getDisplayEvents().filter(e => e.type == DisplayEventType.ERROR);
				expect(errorEvents).toHaveLength(1);
				expect(errorEvents[0].data).toContain('Error thrown by createEngineConfig');

				expect(output).toContain('disable_engine: false');
				expect(output).toContain('someField: some non default value # Modified from: "someDefault"');
			});

			it.each([
				{overrideStatus: 'via override', commentStatus: 'there is a comment', ruleName: 'Stub1Rule7'},
				{overrideStatus: 'by default', commentStatus: 'there is no comment', ruleName: 'Stub1Rule8'}
			])('Edge Case: When including unmodified rule settings and selected rule has no tags $overrideStatus, `tags` is an empty array and $commentStatus', async ({ruleName}) => {
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, [ruleName], undefined, undefined, undefined, true);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations', `${ruleName}.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});

			it('If config is provided with relative path to config_root, then it remains relative in config output even though core makes it absolute for engines', async () => {
				// ==== SETUP ====
				stubConfigFactory.dummyConfigRoot = PATH_TO_EXAMPLE_WORKSPACE;
				// ==== TESTED BEHAVIOR ====
				const output = await runActionAndGetDisplayedConfig(dependencies, ['Stub2Rule1']);

				// ==== ASSERTIONS ====
				const goldFileContents = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'override-configurations', `StubEngine2_forConfigWithRelativePathScenario.yml.goldfile`));
				expect(output).toContain(goldFileContents);
			});
		});
	});

	describe('Target/Workspace resolution', () => {
		const originalCwd: string = process.cwd();
		const baseDir: string = path.resolve(__dirname, '..', '..', 'fixtures', 'example-workspaces', 'workspace-with-misc-files');

		beforeEach(() => {
			process.chdir(baseDir);
		});

		afterEach(() => {
			process.chdir(originalCwd);
		});

		it.each([
			{
				case: 'a workspace is applied to the config',
				workspace: [path.join(baseDir, 'package.json'), path.join(baseDir, 'README.md')],
				target: undefined
			},
			{
				case: 'a target further narrows the explicitly defined workspace',
				workspace: ['.'],
				target: ['package.json', 'README.md']
			},
			{
				case: 'a target further narrows an implicitly defined workspace',
				workspace: undefined,
				target: ['package.json', 'README.md']
			}
		])('When $case, only the relevant rules are returned', async ({workspace, target}) => {
			// ==== SETUP ====
			spyDisplay = new SpyDisplay();
			dependencies = {
				logEventListeners: [new LogEventDisplayer(spyDisplay)],
				progressEventListeners: [],
				viewer: new ConfigStyledYamlViewer(spyDisplay),
				configFactory: new StubCodeAnalyzerConfigFactory(),
				actionSummaryViewer: new ConfigActionSummaryViewer(spyDisplay),
				pluginsFactory: new WorkspaceAwareEnginePluginFactory()
			};

			// ==== TESTED BEHAVIOR ====
			const output: string = await runActionAndGetDisplayedConfig(dependencies, ['all'], undefined, workspace, target, true);

			// ==== ASSERTIONS ====
			const goldFileContents: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'workspace-resolution', 'workspaceAwareRules.yml.goldfile'));
			expect(output).toContain(goldFileContents);
		});
	});

	describe('File Creation', () => {
		beforeEach(() => {
			spyDisplay = new SpyDisplay();
			dependencies = {
				logEventListeners: [],
				progressEventListeners: [],
				viewer: new ConfigStyledYamlViewer(spyDisplay),
				configFactory: new StubCodeAnalyzerConfigFactory(),
				actionSummaryViewer: new ConfigActionSummaryViewer(spyDisplay),
				pluginsFactory: new StubEnginePluginFactory()
			};
		});

		it('If a file is created, then the ConfigViewer is unused', async () => {
			// ==== SETUP ====
			// We need to add a Writer to the dependencies.
			const spyWriter = new SpyConfigWriter();
			dependencies.writer = spyWriter;
			// Replace the viewer with a Spy.
			const spyViewer = new SpyConfigViewer();
			dependencies.viewer = spyViewer;

			// ==== TESTED BEHAVIOR ====
			await runActionAndGetDisplayedConfig(dependencies, ['all']);

			// ==== ASSERTIONS ====
			expect(spyWriter.getCallHistory()).toHaveLength(1);
			expect(spyViewer.getCallHistory()).toHaveLength(0);
		});

		it('If a file is specified by not created, then the ConfigViewer is used', async () => {
			// ==== SETUP ====
			// We need to add a Writer to the dependencies.
			const spyWriter = new SpyConfigWriter(false);
			dependencies.writer = spyWriter;
			// Replace the viewer with a Spy.
			const spyViewer = new SpyConfigViewer();
			dependencies.viewer = spyViewer;

			// ==== TESTED BEHAVIOR ====
			await runActionAndGetDisplayedConfig(dependencies, ['all']);

			// ==== ASSERTIONS ====
			expect(spyWriter.getCallHistory()).toHaveLength(1);
			expect(spyViewer.getCallHistory()).toHaveLength(1);
		});
	});

	describe('Summary generation', () => {
		beforeEach(() => {
			spyDisplay = new SpyDisplay();
			dependencies = {
				logEventListeners: [],
				progressEventListeners: [],
				viewer: new ConfigStyledYamlViewer(spyDisplay),
				configFactory: new StubCodeAnalyzerConfigFactory(),
				actionSummaryViewer: new ConfigActionSummaryViewer(spyDisplay),
				pluginsFactory: new StubEnginePluginFactory()
			}
		});

		it('When an Outfile is created, it is mentioned by the Summarizer', async () => {
			// ==== SETUP ====
			// Assign a Writer to the dependencies.
			dependencies.writer = new SpyConfigWriter(true);

			// ==== TESTED BEHAVIOR ====
			// Invoke the action, specifying an outfile.
			const action = ConfigAction.createAction(dependencies);
			const input: ConfigInput = {
				'rule-selector': ['all'],
				'output-file': 'out-config.yml'
			};
			await action.execute(input);

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			const displayedLogEvents = ansis.strip(displayEvents
				.filter(e => e.type === DisplayEventType.LOG)
				.map(e => e.data)
				.join('\n'));

			const preExecutionGoldfileContents: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'action-summaries', 'pre-execution-summary.txt.goldfile'));
			expect(displayedLogEvents).toContain(preExecutionGoldfileContents);
			const goldfileContents: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'action-summaries', 'outfile-created.txt.goldfile'));
			expect(displayedLogEvents).toContain(goldfileContents);
		});

		it.each([
			{case: 'an Outfile is specified but not written', writer: new SpyConfigWriter(false), outfile: 'out-config.yml'},
			{case: 'an Outfile is not specified at all', writer: undefined, outfile: undefined}
		])('When $case, the Summarizer mentions no outfile', async ({writer, outfile}) => {
			// ==== SETUP ====
			// Add the specified Writer (or lack-of-Writer) to the dependencies.
			dependencies.writer = writer;

			// ==== TESTED BEHAVIOR ====
			// Invoke the action, specifying an outfile (or lack of one).
			const action = ConfigAction.createAction(dependencies);
			const input: ConfigInput = {
				'rule-selector': ['all'],
				'output-file': outfile
			};
			await action.execute(input);

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			const displayedLogEvents = ansis.strip(displayEvents
				.filter(e => e.type === DisplayEventType.LOG)
				.map(e => e.data)
				.join('\n'));

			const preExecutionGoldfileContents: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'action-summaries', 'pre-execution-summary.txt.goldfile'));
			expect(displayedLogEvents).toContain(preExecutionGoldfileContents);
			const goldfileContents: string = await readGoldFile(path.join(PATH_TO_COMPARISON_DIR, 'action-summaries', 'no-outfile-created.txt.goldfile'));
			expect(displayedLogEvents).toContain(goldfileContents);
		});
	})
	// ====== HELPER FUNCTIONS ======

	async function readGoldFile(goldFilePath: string): Promise<string> {
		return fsp.readFile(goldFilePath, {encoding: 'utf-8'});
	}

	async function runActionAndGetDisplayedConfig(dependencies: ConfigDependencies, ruleSelectors: string[], configFile?: string, workspace?: string[], target?: string[], includeUnmodifiedRules?: boolean): Promise<string> {
		// ==== SETUP ====
		const action = ConfigAction.createAction(dependencies);
		const input: ConfigInput = {
			'rule-selector': ruleSelectors,
			'config-file': configFile,
			workspace,
			target,
			'include-unmodified-rules': includeUnmodifiedRules
		};

		// ==== TESTED BEHAVIOR ====
		await action.execute(input);

		// ==== OUTPUT PROCESSING ====
		const displayEvents = spyDisplay.getDisplayEvents();
		const displayedConfigEventArray = displayEvents.filter(e => e.data.includes("CODE ANALYZER CONFIGURATION"));
		if (displayedConfigEventArray.length === 1) {
			return ansis.strip(displayedConfigEventArray[0].data);
		} else {
			return 'Could Not Get Specific Output';
		}
	}
});

// ====== STUBS ======

class StubCodeAnalyzerConfigFactory implements CodeAnalyzerConfigFactory {
	private readonly config: CodeAnalyzerConfig;

	constructor(config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults()) {
		this.config = config;
	}

	public create(): CodeAnalyzerConfig {
		return this.config;
	}
}

class AlternativeStubCodeAnalyzerConfigFactory implements CodeAnalyzerConfigFactory {
	dummyConfigRoot: string = 'null';
	dummyLogFolder: string = 'null';
	stub3DisableEngineValue: boolean = true;

	public create(): CodeAnalyzerConfig {
		const rawConfigFileContents = fs.readFileSync(path.join(PATH_TO_EXAMPLE_WORKSPACE, 'optional-input-config.yml'), 'utf-8');
		const validatedConfigFileContents = rawConfigFileContents
			.replaceAll('__DUMMY_CONFIG_ROOT__', this.dummyConfigRoot)
			.replaceAll('__DUMMY_LOG_FOLDER__', this.dummyLogFolder)
			.replaceAll('__STUB3_DISABLE_ENGINE_VALUE__', String(this.stub3DisableEngineValue))
			.replaceAll('__DUMMY_STUBENGINE2_SUBFIELD__', this.dummyConfigRoot && this.dummyConfigRoot !== 'null' ?
				path.join(this.dummyConfigRoot, 'optional-input-config.yml') : 'dummy');
		return CodeAnalyzerConfig.fromYamlString(validatedConfigFileContents,  process.cwd());
	}
}

class StubEnginePluginFactory implements EnginePluginsFactory {
	public create(): EngineApi.EnginePlugin[] {
		return [
			new StubEnginePlugin()
		];
	}
}

class StubEnginePlugin extends EngineApi.EnginePluginV1 {

	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	/*
	    descriptionText: string;
    valueType: string;
    defaultValue: ConfigValue;
	 */

	private readonly descriptionsByEngine: {[key: string]: EngineApi.ConfigDescription} = {
		StubEngine1: {
			overview: 'This is a generic overview for StubEngine1\nIt has multiple lines of text\nWhee!',
			fieldDescriptions: {
				'Property1': {
					descriptionText: 'This is the description for Property1',
					valueType: 'string',
					defaultValue: 'default1'
				},
				// Property2 is undocumented
				'Property3': {
					descriptionText: 'This is the description for Property3',
					valueType: 'string',
					defaultValue: 'default3'
				},
				'Property4': {
					descriptionText: 'This is the description for Property4',
					valueType: 'object',
					defaultValue: {SubProperty1: 10, SubProperty2: true}
				},
				'Property5': {
					descriptionText: 'This is the description for Property5',
					valueType: 'array',
					defaultValue: ['arr1', 'arr2']
				},
				'Property6': {
					descriptionText: 'This is the description for Property6',
					valueType: 'string',
					defaultValue: null
				},
			}
		},
		StubEngine2: {
			overview: 'Some overview for StubEngine2',
			fieldDescriptions: {
				'top_field': {
					descriptionText: 'Some description for top_field',
					valueType: 'object',
					defaultValue: {}
				}
			}
		}
		// StubEngine3 also has no overview or documented properties.
	}

	public getAvailableEngineNames(): string[] {
		return ['StubEngine1', 'StubEngine2', 'StubEngine3'];
	}

	public createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		if (engineName === 'StubEngine1') {
			this.createdEngines.set(engineName, new StubEngine1(config));
		} else if (engineName === 'StubEngine2') {
			this.createdEngines.set(engineName, new StubEngine2(config));
		} else if (engineName === 'StubEngine3') {
			this.createdEngines.set(engineName, new StubEngine3(config));
		} else {
			throw new Error(`No engine named ${engineName}`);
		}
		return Promise.resolve(this.getCreatedEngine(engineName));
	}

	public createEngineConfig(engineName: string, configValueExtractor: EngineApi.ConfigValueExtractor): Promise<EngineApi.ConfigObject> {
		if (engineName === 'StubEngine1') {
			return Promise.resolve({
				Property1: configValueExtractor.extractString('Property1', 'default1')!,
				Property2: configValueExtractor.extractString('Property2', 'default2')!,
				Property3: configValueExtractor.extractString('Property3', 'default3')!,
				Property4: configValueExtractor.extractObject('Property4', {SubProperty1: 10, SubProperty2: true})!,
				Property5: configValueExtractor.extractArray('Property5', EngineApi.ValueValidator.validateString, ['arr1', 'arr2'])!
			});
		} else if (engineName === 'StubEngine2') {
			return Promise.resolve(configValueExtractor.getObject());
		} else if (engineName === 'StubEngine3') {
			return Promise.resolve(configValueExtractor.getObject());
		} else {
			throw new Error('Cannot configure unknown engine ' + engineName);
		}
	}

	public describeEngineConfig(engineName: string): EngineApi.ConfigDescription {
		return this.descriptionsByEngine[engineName] ?? {};
	}

	public getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName) as EngineApi.Engine;
		}
		throw new Error(`Engine named ${engineName} not yet instantiated`);
	}
}

class StubEngine1 extends EngineApi.Engine {

	public constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	public getName(): string {
		return 'StubEngine1';
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.0");
	}

	public describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([{
			name: 'Stub1Rule1',
			severityLevel: EngineApi.SeverityLevel.Info,
			tags: ["Recommended", "CodeStyle"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule2',
			severityLevel: EngineApi.SeverityLevel.Moderate,
			tags: ["CodeStyle"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule3',
			severityLevel: EngineApi.SeverityLevel.Low,
			tags: ["BestPractices"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule4',
			severityLevel: EngineApi.SeverityLevel.High,
			tags: ["CodeStyle"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule5',
			severityLevel: EngineApi.SeverityLevel.High,
			tags: ["Recommended", "CodeStyle"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule6',
			severityLevel: EngineApi.SeverityLevel.Low,
			tags: ["Recommended"],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule7',
			severityLevel: EngineApi.SeverityLevel.Moderate,
			tags: [],
			description: 'Generic description',
			resourceUrls: []
		}, {
			name: 'Stub1Rule8',
			severityLevel: EngineApi.SeverityLevel.Moderate,
			tags: ['Recommended'],
			description: 'Generic description',
			resourceUrls: []
		}]);
	}

	public runRules(): Promise<EngineApi.EngineRunResults> {
		return Promise.resolve({
			violations: []
		});
	}
}

class StubEngine2 extends EngineApi.Engine {
	public constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	public getName(): string {
		return 'StubEngine2';
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.2");
	}

	public describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([{
			name: 'Stub2Rule1',
			severityLevel: EngineApi.SeverityLevel.Moderate,
			tags: ['Security'],
			description: 'Generic description',
			resourceUrls: []
		}]);
	}

	public runRules(): Promise<EngineApi.EngineRunResults> {
		return Promise.resolve({
			violations: []
		});
	}
}

class StubEngine3 extends EngineApi.Engine {
	public constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	public getName(): string {
		return 'StubEngine3';
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.3");
	}

	public describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([{
			name: 'Stub3Rule1',
			severityLevel: EngineApi.SeverityLevel.Moderate,
			tags: ['CodeStyle'],
			description: 'Generic description',
			resourceUrls: []
		}]);
	}

	public runRules(): Promise<EngineApi.EngineRunResults> {
		return Promise.resolve({
			violations: []
		});
	}
}

class WorkspaceAwareEnginePluginFactory implements EnginePluginsFactory {
	public create(): EngineApi.EnginePlugin[] {
		return [new WorkspaceAwareEnginePlugin()];
	}
}

class WorkspaceAwareEnginePlugin extends EngineApi.EnginePluginV1 {
	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	getAvailableEngineNames(): string[] {
		return ['workspaceAwareEngine'];
	}

	createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		if (engineName === 'workspaceAwareEngine') {
			this.createdEngines.set(engineName, new WorkspaceAwareEngine(config));
		} else {
			throw new Error(`no engine named ${engineName}`);
		}
		return Promise.resolve(this.getCreatedEngine(engineName));
	}

	public getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName)!;
		}
		throw new Error(`Engine named ${engineName} not yet instantiated`);
	}
}

class WorkspaceAwareEngine extends EngineApi.Engine {
	public constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	public getName(): string {
		return 'workspaceAwareEngine';
	}

	public getEngineVersion(): Promise<string> {
		return Promise.resolve('1.0.0');
	}

	public async describeRules(describeOptions: EngineApi.DescribeOptions): Promise<EngineApi.RuleDescription[]> {
		if (!describeOptions.workspace) {
			return Promise.resolve([]);
		}

		// Derive a rule for each of the targeted files.
		return (await describeOptions.workspace.getTargetedFiles()).map(fileOrFolder => {
			return {
				name: `ruleFor${path.basename(fileOrFolder)}`,
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ['Recommended'],
				description: `Rule synthesized for target "${fileOrFolder}`,
				resourceUrls: [`https://example.com/${fileOrFolder}`]
			};
		});
	}

	public runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		// Don't need to actually run any rules, since we're just testing configuration.
		return Promise.resolve({violations: []});
	}
}

class FactoryForThrowingEnginePlugin implements EnginePluginsFactory {
    create(): EngineApi.EnginePlugin[] {
        return [new ThrowingEnginePlugin()];
    }
}

class ThrowingEnginePlugin extends EngineApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['uncreatableEngine'];
    }

	describeEngineConfig(): EngineApi.ConfigDescription {
		return {
			overview: 'Some Overview',
			fieldDescriptions: {
				someField: {
					descriptionText: 'some description',
					valueType: 'string',
					defaultValue: 'someDefault'
				}
			}
		}
	}

	createEngineConfig(_engineName: string, _configValueExtractor: EngineApi.ConfigValueExtractor): Promise<EngineApi.ConfigObject> {
		throw new Error('Error thrown by createEngineConfig');
	}

    createEngine(_engineName: string, _resolvedConfig: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
        throw new Error('Should not be called.');
    }
}
