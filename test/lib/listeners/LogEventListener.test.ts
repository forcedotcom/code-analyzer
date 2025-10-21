import {CodeAnalyzer, CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {LogLevel} from '@salesforce/code-analyzer-engine-api';
import {LogEventDisplayer} from '../../../src/lib/listeners/LogEventListener.js';
import {DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay.js';
import {SpyLogWriter} from '../../stubs/SpyLogWriter.js';
import {EventConfigurableEngine1, ConfigurableStubEnginePlugin1} from '../../stubs/StubEnginePlugins.js';
import {LogEventLogger} from '../../../src/lib/listeners/LogEventListener.js';

describe('LogEventListener implementations', () => {
	let spyDisplay: SpyDisplay;
	let engine1: EventConfigurableEngine1;
	let stubEnginePlugin: ConfigurableStubEnginePlugin1;
	let core: CodeAnalyzer;

	beforeEach(async () => {
		spyDisplay = new SpyDisplay();
		engine1 = new EventConfigurableEngine1({});
		stubEnginePlugin = new ConfigurableStubEnginePlugin1();
		stubEnginePlugin.addEngine(engine1);
		core = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
		await core.addEnginePlugin(stubEnginePlugin);
	});

	describe('LogEventDisplayer', () => {
		let logEventDisplayer: LogEventDisplayer;

		beforeEach(() => {
			logEventDisplayer = new LogEventDisplayer(spyDisplay);
		});

		it.each([
			{levelName: "Error", logLevel: LogLevel.Error, displayType: 'errors', displayEvent: DisplayEventType.ERROR},
			{levelName: "Warn", logLevel: LogLevel.Warn, displayType: 'warnings', displayEvent: DisplayEventType.WARN},
			{levelName: "Info", logLevel: LogLevel.Info, displayType: 'info-logs', displayEvent: DisplayEventType.INFO},
		])('Displays $levelName-type log events as $displayType', async ({logLevel, displayEvent}) => {
			// ==== TEST SETUP ====
			const expectedMessages: string[] = ['message1', 'message2', 'message3'];
			for (const expectedMessage of expectedMessages) {
				engine1.addLogEvents({logLevel, message: expectedMessage});
			}
			// The specific files we target in our workspace don't matter.
			const workspace = await core.createWorkspace(['package.json']);
			const ruleSelection = await core.selectRules(['all'], {workspace});

			// ==== TESTED BEHAVIOR ====
			logEventDisplayer.listen(core);
			await core.run(ruleSelection, {
				workspace
			});
			logEventDisplayer.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(6);
			for (let i = 0; i < 3; i++) {
				expect(displayEvents[i*2].type).toEqual(displayEvent);
				expect(displayEvents[i*2].data).toContain(expectedMessages[i]);
				expect(displayEvents[i*2+1]).toEqual({type: DisplayEventType.INFO, data: ""}); // We display an empty line after each message
			}
		});

		it.each([
			{levelName: "Debug", logLevel: LogLevel.Debug},
			{levelName: 'Fine', logLevel: LogLevel.Fine}
		])('Does NOT display events of type $levelName', async ({logLevel}) => {
			// ==== TEST SETUP ====
			const messages = ['message1', 'message2', 'message3'];
			for (const message of messages) {
				engine1.addLogEvents({logLevel, message});
			}
			// The specific files we include in our workspace don't matter.
			const workspace = await core.createWorkspace(['package.json']);
			const ruleSelection = await core.selectRules(['all'], {workspace});

			// ==== TESTED BEHAVIOR ====
			logEventDisplayer.listen(core);
			await core.run(ruleSelection, {workspace});
			logEventDisplayer.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});
	});

	describe('LogEventLogger', () => {
		it('When using default log level, log writer includes all but fine messags', async () => {
			engine1.addLogEvents(
				{logLevel: LogLevel.Fine, message: 'fineMessage'},
				{logLevel: LogLevel.Debug, message: 'debugMessage'},
				{logLevel: LogLevel.Info, message: 'infoMessage'},
				{logLevel: LogLevel.Warn, message: 'warnMessage'},
				{logLevel: LogLevel.Error, message: 'errorMessage'}
			);

			const spyLogWriter = new SpyLogWriter();
			const logListener = new LogEventLogger(spyLogWriter);

			// The specific files we include in our workspace don't matter.
			const workspace = await core.createWorkspace(['package.json']);
			const ruleSelection = await core.selectRules(['all'], {workspace});

			// ==== TESTED BEHAVIOR ====
			logListener.listen(core);
			await core.run(ruleSelection, {workspace});
			logListener.stopListening();

			// ==== ASSERTIONS ====
			// Verify that the right messages were logged.
			const logContents = spyLogWriter.getWrittenLog();
			expect(logContents).not.toContain('fineMessage');
			expect(logContents).toContain('debugMessage');
			expect(logContents).toContain('infoMessage');
			expect(logContents).toContain('warnMessage');
			expect(logContents).toContain('errorMessage');
		});

		it('When user specify fine level logs, then they are included as well as the others', async () => {
			core = new CodeAnalyzer(CodeAnalyzerConfig.fromObject({log_level: LogLevel.Fine}));
			await core.addEnginePlugin(stubEnginePlugin);

			engine1.addLogEvents(
				{logLevel: LogLevel.Fine, message: 'fineMessage'},
				{logLevel: LogLevel.Debug, message: 'debugMessage'},
				{logLevel: LogLevel.Info, message: 'infoMessage'},
				{logLevel: LogLevel.Warn, message: 'warnMessage'},
				{logLevel: LogLevel.Error, message: 'errorMessage'}
			);

			const spyLogWriter = new SpyLogWriter();
			const logListener = new LogEventLogger(spyLogWriter);

			// The specific files we include in our workspace don't matter.
			const workspace = await core.createWorkspace(['package.json']);
			const ruleSelection = await core.selectRules(['all'], {workspace});

			// ==== TESTED BEHAVIOR ====
			logListener.listen(core);
			await core.run(ruleSelection, {workspace});
			logListener.stopListening();

			// ==== ASSERTIONS ====
			// Verify that the right messages were logged.
			const logContents = spyLogWriter.getWrittenLog();
			expect(logContents).toContain('fineMessage');
			expect(logContents).toContain('debugMessage');
			expect(logContents).toContain('infoMessage');
			expect(logContents).toContain('warnMessage');
			expect(logContents).toContain('errorMessage');
		});
	});
});
