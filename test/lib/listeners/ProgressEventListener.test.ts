import {CodeAnalyzer, CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {EngineRunProgressSpinner, RuleSelectionProgressSpinner} from '../../../src/lib/listeners/ProgressEventListener.js';
import {SpyDisplay, DisplayEvent, DisplayEventType} from '../../stubs/SpyDisplay.js';
import {ConfigurableStubEnginePlugin1, EventConfigurableEngine1, TimeableStubEnginePlugin1, TimeableEngine1, TimeableEngine2} from '../../stubs/StubEnginePlugins.js';
import {StubEnginePluginsFactory_withFunctionalStubEngine} from '../../stubs/StubEnginePluginsFactories.js';

describe('ProgressEventListener implementations', () => {
	let codeAnalyzer: CodeAnalyzer;
	let spyDisplay: SpyDisplay;

	beforeEach(() => {
		codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
		spyDisplay = new SpyDisplay();
	});

	describe('RuleSelectionProgressSpinner', () => {
		let spinner: RuleSelectionProgressSpinner;

		afterEach(() => {
			spinner.stopListening();
		});

		it('If not told to listen, does not listen', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new RuleSelectionProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Select rules without telling the spinner to start listening.
			await codeAnalyzer.selectRules(['all']);

			// ==== ASSERTIONS ====
			// Expect no events.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it('Listens silently until selection progress events start coming in', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new RuleSelectionProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Start listening, then immediately stop without actually doing anything.
			spinner.listen(codeAnalyzer);
			spinner.stopListening();

			// ==== ASSERTIONS ====
			// Expect no events.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it('Properly processes incoming events from Core', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new RuleSelectionProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Start listening, select some rules, then stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.selectRules(['all']);
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			// The first event should have been the Spinner Start setting completion to 0.
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			expect(startEvent.data).toContain(`Eligible engines: ${codeAnalyzer.getEngineNames().join(', ')}; Completion: 0%; Elapsed time: 0s`);
			const percentagesInOrder = getDedupedCompletionPercentages(displayEvents.slice(0, displayEvents.length - 1));
			expect(percentagesInOrder.length).toBeGreaterThan(2);
			expect(percentagesInOrder[0]).toEqual(0);
			expect(percentagesInOrder[percentagesInOrder.length-1]).toEqual(100);
			for (let i = 1; i < percentagesInOrder.length; i++) {
				expect(percentagesInOrder[i]).toBeGreaterThan(percentagesInOrder[i-1]);
			}
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toEqual(`done.`);
		});

		it('Properly aggregates percentages across multiple Cores', async () => {
			// ==== TEST SETUP ====
			// Instantiate a second Core and assign the standard functional stubs to both instances.
			const secondCore: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
			const factory1 = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory1.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			const factory2 = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory2.create()) {
				await secondCore.addEnginePlugin(enginePlugin);
			}

			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new RuleSelectionProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Start listening to the spinners, select some rules in each one, then stop listening.
			spinner.listen(codeAnalyzer, secondCore);
			await codeAnalyzer.selectRules(['all']);
			await secondCore.selectRules(['all']);
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			// The first event should have been the Spinner Start setting completion to 0.
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			expect(startEvent.data).toContain(`Eligible engines: ${codeAnalyzer.getEngineNames().join(', ')}; Completion: 0%; Elapsed time: 0s`);
			const percentagesInOrder = getDedupedCompletionPercentages(displayEvents.slice(0, displayEvents.length - 1));
			expect(percentagesInOrder.length).toBeGreaterThan(2);
			expect(percentagesInOrder[0]).toEqual(0);
			expect(percentagesInOrder[percentagesInOrder.length-1]).toEqual(100);
			for (let i = 1; i < percentagesInOrder.length; i++) {
				expect(percentagesInOrder[i]).toBeGreaterThan(percentagesInOrder[i-1]);
			}
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toEqual('done.');
		});

		it('Properly interleaves progress updates with ticking', async () => {
			// ==== TEST SETUP ====
			// Use a plugin with engines that can be configured to wait a certain amount of time between sending their
			// rule selection events.
			const timeablePlugin = new TimeableStubEnginePlugin1();
			await codeAnalyzer.addEnginePlugin(timeablePlugin);
			const engine1: TimeableEngine1 = timeablePlugin.getCreatedEngine('timeableEngine1') as TimeableEngine1;
			const engine2: TimeableEngine2 = timeablePlugin.getCreatedEngine('timeableEngine2') as TimeableEngine2;
			// Tell the engines to wait for a relatively small amount of time (less than a second, so the test doesn't take forever).
			engine1.setRuleSelectionWaitTime(250);
			engine2.setRuleSelectionWaitTime(250);


			// Set the spinner's tick time to be unrealistically low, to make sure ticks happen between engine update events.
			spinner = new RuleSelectionProgressSpinner(spyDisplay, 50);

			// ==== TESTED BEHAVIOR ====
			// Start listening, select some rules, and stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.selectRules(['all']);
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			expect(startEvent.data).toContain(`Eligible engines: ${codeAnalyzer.getEngineNames().join(', ')}; Completion: 0%`);
			const percentagesInOrder = getDedupedCompletionPercentages(displayEvents.slice(0, displayEvents.length - 1));
			// We know that each engine is going to send events for 40%, 60%, and 100%, and that each engine will send its
			// updates in roughly the same timeframe.
			expect(percentagesInOrder).toEqual([0, 20, 40, 50, 60, 80, 100]);
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toEqual('done.');
		});
	});

	describe('EngineRunProgressSpinner', () => {
		let spinner: EngineRunProgressSpinner;

		afterEach(() => {
			spinner.stopListening();
		});

		it('If not told to listen, does not listen', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1']);
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// The specific targets we use for our workspace don't matter.
			const workspace = await codeAnalyzer.createWorkspace(['package.json']);

			// ==== TESTED BEHAVIOR ====
			// Run rules without telling the spinner to start listening.
			await codeAnalyzer.run(ruleSelection, {
				workspace
			});

			// ==== ASSERTIONS ====
			// Expect no events.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it('Waits silently until execution progress events start coming in', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}

			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Start listening, and immediately stop without actually doing anything.
			spinner.listen(codeAnalyzer);
			spinner.stopListening();

			// ==== ASSERTIONS ====
			// Expect no events.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it('Properly processes progress updates from engine', async () => {
			// ==== TEST SETUP ====
			//  Assign our standard functional stubs to the core.
			const factory = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			// Use only rules from one engine, since this test isn't about how engines interleave.
			const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1']);
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// The specific targets we use for our workspace don't matter.
			const workspace = await codeAnalyzer.createWorkspace(['package.json']);

			// ==== TESTED BEHAVIOR ====
			// Start listening, then execute the rules, then stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.run(ruleSelection, {
				workspace
			});
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			// The first event should have been the Spinner Start.
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			// The start event should always start with at least 1 known engine, to prevent "0 of 0 engines" scenarios.
			expect(startEvent.data).toContain("0 of 1 engines");
			const percentagesInOrder = getDedupedCompletionPercentages(displayEvents.slice(1, displayEvents.length - 1));
			expect(percentagesInOrder).toEqual([0, 50, 100]);
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toContain('done. Executed rules from stubEngine1.');
		});

		it('Properly interleaves progress updates from multiple engines', async () => {
			// ==== TEST SETUP ====
			// Use a plugin with engines that can be configured to wait a certain amount of time between sending their
			// update events.
			const timeablePlugin = new TimeableStubEnginePlugin1();
			await codeAnalyzer.addEnginePlugin(timeablePlugin);
			// Tell the engines to wait for different amounts of time, so their progress events interleave.
			const engine1: TimeableEngine1 = timeablePlugin.getCreatedEngine('timeableEngine1') as TimeableEngine1;
			const engine2: TimeableEngine2 = timeablePlugin.getCreatedEngine('timeableEngine2') as TimeableEngine2;
			engine1.setEngineExecutionWaitTime(300);
			engine2.setEngineExecutionWaitTime(400);
			// The specific files we use for our workspace don't matter.
			const workspace = await codeAnalyzer.createWorkspace(['package.json']);
			// Select rules from both engines.
			const ruleSelection = await codeAnalyzer.selectRules(['all']);
			// To prevent the spinner's ticking from messing with the test, turn ticking off.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Start listening, execute the rules, and stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.run(ruleSelection, {
				workspace
			});
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			// The first event should have been the Spinner Start.
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			// Engine1 comes in first.
			const engine1Percents = getDedupedCompletionPercentages(displayEvents.slice(1, displayEvents.length - 1), engine1.getName());
			// Engine2 comes in second.
			const engine2Percents = getDedupedCompletionPercentages(displayEvents.slice(2, displayEvents.length - 1), engine2.getName());
			// Both engines should proceed in the expected percentage order.
			expect(engine1Percents).toEqual([0, 50, 100]);
			expect(engine2Percents).toEqual([0, 50, 100]);
			// The final event should be the Stop event.
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toMatch(/done\. Executed rules from (timeableEngine1, timeableEngine2|timeableEngine2, timeableEngine1)\./);
		});

		it('Properly interleaves progress updates with ticking', async () => {
			// ==== TEST SETUP ====
			// Use a plugin with engines that can be configured to wait a certain amount of time between sending their
			// update events.
			const timeablePlugin = new TimeableStubEnginePlugin1();
			await codeAnalyzer.addEnginePlugin(timeablePlugin);
			const engine: TimeableEngine1 = timeablePlugin.getCreatedEngine('timeableEngine1') as TimeableEngine1;
			// Tell it to wait for a relatively small amount of time (less than a second, so the test doesn't take forever).
			engine.setEngineExecutionWaitTime(500);
			// The specific files we use for our workspace don't matter.
			const workspace = await codeAnalyzer.createWorkspace(['package.json']);
			// Select only rules from one engine, since this test is about how one engine interleaves with ticking, not
			// how multiple engines interleave with each other.
			const ruleSelection = await codeAnalyzer.selectRules(['timeableEngine1'], {workspace});
			// Set the spinner's tick time to be unrealistically low, to make sure ticks happen between engine update events.
			spinner = new EngineRunProgressSpinner(spyDisplay, 200);

			// ==== TESTED BEHAVIOR ====
			// Start listening, execute the rules, and stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.run(ruleSelection, {
				workspace
			});
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			const percentagesInOrder = getDedupedCompletionPercentages(displayEvents.slice(1, displayEvents.length - 1));
			expect(percentagesInOrder).toEqual([0, 50, 100]);
			const endEvent = displayEvents[displayEvents.length - 1];
			expect(endEvent).toHaveProperty('type', DisplayEventType.SPINNER_STOP);
			expect(endEvent.data).toContain('done. Executed rules from timeableEngine1.');
		}, 10000);

		it('When an engine supplies status messages with its progress, those messages are displayed', async () => {
			// ==== TEST SETUP ====
			// Assign our event-configurable engine to the core.
			const engine: EventConfigurableEngine1 = new EventConfigurableEngine1({});
			const plugin = new ConfigurableStubEnginePlugin1();
			plugin.addEngine(engine);
			await codeAnalyzer.addEnginePlugin(plugin);
			// Give the engine some progress events.
			engine.addRunProgressEvents(
				{percentComplete: 10},
				{percentComplete: 15, message: 'Progress Message 1'},
				{percentComplete: 25},
				{percentComplete: 50, message: 'Progress Message 2'},
				{percentComplete: 75},
				{percentComplete: 90, message: 'Progress Message 3'},
			);
			const ruleSelection = await codeAnalyzer.selectRules(['eventConfigurableEngine1']);
			// We don't want automated ticking to mess with the messages, so just turn it off for now.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// The specific targets we use for our workspace don't matter.
			const workspace = await codeAnalyzer.createWorkspace(['package.json']);

			// ==== TESTED BEHAVIOR ====
			// Start listening, then execute the rules, then stop listening.
			spinner.listen(codeAnalyzer);
			await codeAnalyzer.run(ruleSelection, {
				workspace
			});
			spinner.stopListening();

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			// The first event should have been the Spinner Start.
			const startEvent = displayEvents[0];
			expect(startEvent).toHaveProperty('type', DisplayEventType.SPINNER_START);
			// The start event should always start with at least 1 known engine, to prevent "0 of 0 engines" scenarios.
			expect(startEvent.data).toContain("0 of 1 engines");
			const progressEventsInOrder: string[] = displayEvents.slice(1, displayEvents.length - 1).map(e => e.data);
			expect(progressEventsInOrder[0]).toContain("- eventConfigurableEngine1 at 0% completion.");
			expect(progressEventsInOrder[1]).toContain("- eventConfigurableEngine1 at 10% completion.");
			expect(progressEventsInOrder[2]).toContain("- eventConfigurableEngine1 at 15% completion - Progress Message 1");
			expect(progressEventsInOrder[3]).toContain("- eventConfigurableEngine1 at 25% completion.");
			expect(progressEventsInOrder[4]).toContain("- eventConfigurableEngine1 at 50% completion - Progress Message 2");
			expect(progressEventsInOrder[5]).toContain("- eventConfigurableEngine1 at 75% completion.");
			expect(progressEventsInOrder[6]).toContain("- eventConfigurableEngine1 at 90% completion - Progress Message 3");
		});

		// There's currently no need for this Spinner to accept multiple Cores, so we've opted to not implement that
		// functionality. We're locking that in with a test, and we can change this test if we ever decide to support it.
		it('Rejects multiple Cores', async () => {
			// ==== TEST SETUP ====
			// Instantiate a second Core and assign the standard functional stubs to both instances.
			const secondCore: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
			const factory1 = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory1.create()) {
				await codeAnalyzer.addEnginePlugin(enginePlugin);
			}
			const factory2 = new StubEnginePluginsFactory_withFunctionalStubEngine();
			for (const enginePlugin of factory2.create()) {
				await secondCore.addEnginePlugin(enginePlugin);
			}
			// The spinner's tick time doesn't matter for this test, so just turn it off.
			spinner = new EngineRunProgressSpinner(spyDisplay, -1);

			// ==== TESTED BEHAVIOR ====
			// Attempt to listen to both Cores, and verify that the expected error is thrown.
			expect(() => spinner.listen(codeAnalyzer, secondCore)).toThrow(/Developer Error:/);
		});
	});

	/**
	 * It's possible (and in fact quite likely) that a list of display events includes redundant entries. For example, the
	 * analyzer and an engine could both send a 0% or 100% completion event.
	 * This helper method removes repeated completion percentages from the display events, to keep the tests flexible.
	 */
	function getDedupedCompletionPercentages(displayEvents: DisplayEvent[], engine?: string): number[] {
		const regex = new RegExp(`${engine ? engine + ' at ' : ''}(\\d+)%`);
		const percentMatches = displayEvents.map(e => regex.exec(e.data)).filter(v => v !== null);
		const parsedPercents: number[] = percentMatches.map(m => parseInt((m as RegExpExecArray)[1]));
		const dedupedPercents: number[] = [];
		let previousPercent = -1;
		for (const percent of parsedPercents) {
			if (percent != previousPercent) {
				dedupedPercents.push(percent);
				previousPercent = percent;
			}
		}
		return dedupedPercents;
	}
});
