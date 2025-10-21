import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import ansis from 'ansis';
import {CodeAnalyzer, CodeAnalyzerConfig} from '@salesforce/code-analyzer-core';
import {RuleDescription, Violation} from '@salesforce/code-analyzer-engine-api';

import {
	findLongestCommonParentFolderOf,
	ResultsDetailDisplayer,
	ResultsTableDisplayer
} from '../../../src/lib/viewers/ResultsViewer.js';
import {BundleName, getMessage} from '../../../src/lib/messages.js';
import {DisplayEvent, DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay.js';
import {FunctionalStubEnginePlugin1, StubEngine1} from '../../stubs/StubEnginePlugins.js';

const PATH_TO_COMPARISON_FILES = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'comparison-files', 'lib',
	'viewers', 'ResultsViewer.test.ts');

const PATH_TO_SAMPLE_CODE = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'sample-code');
const PATH_TO_SOME_FILE = path.resolve(PATH_TO_SAMPLE_CODE, 'someFile.cls');
const PATH_TO_FILE_A = path.resolve(PATH_TO_SAMPLE_CODE, 'fileA.cls');
const PATH_TO_FILE_Z = path.resolve(PATH_TO_SAMPLE_CODE, 'fileZ.cls');

describe('ResultsViewer implementations', () => {

	let spyDisplay: SpyDisplay;
	let codeAnalyzerCore: CodeAnalyzer;
	let stubEnginePlugin: FunctionalStubEnginePlugin1;
	let engine1: StubEngine1;
	let rule1: RuleDescription;
	let rule2: RuleDescription;

	beforeEach(async () => {
		spyDisplay = new SpyDisplay();
		codeAnalyzerCore = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
		stubEnginePlugin = new FunctionalStubEnginePlugin1();
		await codeAnalyzerCore.addEnginePlugin(stubEnginePlugin);
		engine1 = stubEnginePlugin.getCreatedEngine('stubEngine1') as StubEngine1;
		rule1 = (await engine1.describeRules())[0];
		rule2 = (await engine1.describeRules())[1];
	});

	describe('ResultsDetailDisplayer', () => {
		let viewer: ResultsDetailDisplayer;

		beforeEach(() => {
			viewer = new ResultsDetailDisplayer(spyDisplay);
		});

		it('When given no results, outputs nothing', async () => {
			// ==== TEST SETUP ====
			// "Run" the plugin without assigning any violations.
			const workspace = await codeAnalyzerCore.createWorkspace(['package.json']);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED METHOD ====
			// Pass the empty result object into the viewer.
			viewer.view(results);

			// ==== ASSERTIONS ====
			// Expect nothing to have been displayed.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it(`When there are violations, all are shown`, async () => {
			// ==== TEST SETUP ====
			// This test doesn't care about sorting, so just assign our engine several copies of the same violation.
			const violations: Violation[] = repeatViolation(
				createViolation(rule1.name, PATH_TO_SOME_FILE, 1, 1, ['https://violation_specific.url']),
				4);
			engine1.resultsToReturn = {violations};
			const workspace = await codeAnalyzerCore.createWorkspace([PATH_TO_SOME_FILE]);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			// "Run" the plugin.
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED METHOD ====
			// Pass the result object into the viewer.
			viewer.view(results);

			// ==== ASSERTIONS ====
			// Compare the text in the events with the text in our comparison files.
			const actualDisplayEvents: DisplayEvent[] = spyDisplay.getDisplayEvents();
			for (const event of actualDisplayEvents) {
				expect(event.type).toEqual(DisplayEventType.LOG);
			}
			// Rip off all of ansis's styling, so we're just comparing plain text.
			const actualEventText = ansis.strip(actualDisplayEvents.map(e => e.data).join('\n'));
			const expectedViolationDetails = (await readComparisonFile('four-identical-violations-details.txt'))
				.replaceAll("{{PATHSEP}}", path.sep)
				.replace("{{RUNDIR}}", results.getRunDirectory());
			expect(actualEventText).toEqual(expectedViolationDetails);
		});

		// The reasoning behind this sorting order is so that the Detail view can function as a "show me the N most
		// severe violations" option.
		it('Results are sorted by severity, then file, then location', async () => {
			// ==== TEST SETUP ====
			// Populate the engine with:
			const violations: Violation[] = [
				// A low-severity violation late in a high-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_A, 20, 1),
				// A low-severity violation early in the same high-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_A, 1, 1),
				// A low-severity violation early in a low-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_Z, 1, 1),
				// A high-severity violation later in the same low-alphabetical file.
				createViolation(rule2.name, PATH_TO_FILE_Z, 20, 1)
			];
			engine1.resultsToReturn = {violations};
			// "Run" the plugin.
			const workspace = await codeAnalyzerCore.createWorkspace(['package.json']);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED METHOD ====
			// Pass the result object into the viewer.
			viewer.view(results);

			// ==== ASSERTIONS ====
			// Compare the text in the events with the text in our comparison file.
			const actualDisplayEvents: DisplayEvent[] = spyDisplay.getDisplayEvents();
			for (const event of actualDisplayEvents) {
				expect(event.type).toEqual(DisplayEventType.LOG);
			}
			// Rip off all of ansis's styling, so we're just comparing plain text.
			const actualEventText = ansis.strip(actualDisplayEvents.map(e => e.data).join('\n'));
			const expectedViolationDetails = (await readComparisonFile('four-unique-violations-details.txt'))
				.replaceAll("{{PATHSEP}}", path.sep)
				.replace("{{RUNDIR}}", results.getRunDirectory());
			expect(actualEventText).toEqual(expectedViolationDetails);
		});

		it('Multi-location violations are correctly displayed', async () => {
			// ==== TEST SETUP ====
			// Populate the engine with:
			const violations: Violation[] = [
				// A violation.
				createViolation(rule1.name, PATH_TO_FILE_A, 20, 1),
			];

			// Add some additional locations to the violation.
			violations[0].codeLocations.push({
				file: PATH_TO_FILE_Z,
				startLine: 2,
				startColumn: 1,
				endColumn: 7,
				comment: 'This is a comment at Location 2',
			}, {
				file: PATH_TO_FILE_A,
				startLine: 1,
				startColumn: 1,
				endLine: 3,
				comment: 'This is a comment at Location 3'
			});
			// Declare the second location to be the primary.
			violations[0].primaryLocationIndex = 1;
			engine1.resultsToReturn = {violations};

			// "Run" the plugin.
			const workspace = await codeAnalyzerCore.createWorkspace(['package.json']);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED METHOD ====
			// Pass the result object into the viewer.
			viewer.view(results);

			// ==== ASSERTIONS ====
			// Compare the text in the events with the text in our comparison file.
			const actualDisplayEvents: DisplayEvent[] = spyDisplay.getDisplayEvents();
			for (const event of actualDisplayEvents) {
				expect(event.type).toEqual(DisplayEventType.LOG);
			}
			// Rip off all of ansis's styling, so we're just comparing plain text.
			const actualEventText = ansis.strip(actualDisplayEvents.map(e => e.data).join('\n'));
			const expectedViolationDetails = (await readComparisonFile('one-multilocation-violation-details.txt'))
				.replaceAll("{{PATHSEP}}", path.sep)
				.replace("{{RUNDIR}}", results.getRunDirectory());
			expect(actualEventText).toEqual(expectedViolationDetails);
		})
	});

	describe('ResultsTableDisplayer', () => {
		let viewer: ResultsTableDisplayer;

		beforeEach(() => {
			viewer = new ResultsTableDisplayer(spyDisplay);
		})

		it('When given no results, outputs nothing', async () => {
			// ==== TEST SETUP ====
			// "Run" the plugin without assigning any violations.
			const workspace = await codeAnalyzerCore.createWorkspace(['package.json']);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED METHOD ====
			// Pass the empty result object into the viewer.
			viewer.view(results);

			// ==== ASSERTIONS ====
			// Expect nothing to have been displayed.
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});

		it('When given violations, they are displayed as a table', async () => {
			// ==== SETUP ====
			// This test doesn't care about sorting, so just assign our engine several copies of the same violation.
			const violations: Violation[] = repeatViolation(
				createViolation(rule1.name, PATH_TO_SOME_FILE, 1, 1),
				4
			);
			engine1.resultsToReturn = {violations};
			const workspace = await codeAnalyzerCore.createWorkspace([PATH_TO_SOME_FILE]);
			const rules = await codeAnalyzerCore.selectRules(['all']);
			// "Run" the plugin.
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED BEHAVIOR ====
			viewer.view(results);

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(4);
			expect(displayEvents[0].type).toEqual(DisplayEventType.LOG);
			expect(displayEvents[0].data).toEqual('');
			expect(displayEvents[1].type).toEqual(DisplayEventType.LOG);
			expect(displayEvents[1].data).toEqual(getMessage(BundleName.ResultsViewer, 'summary.shared.results-relative-to', [PATH_TO_SAMPLE_CODE]));
			expect(displayEvents[2].type).toEqual(DisplayEventType.TABLE);
			expect(displayEvents[2].data).toEqual(`{"columns":["#","Severity","Rule","Location","Message"],"rows":[{"num":1,"location":"someFile.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"},{"num":2,"location":"someFile.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"},{"num":3,"location":"someFile.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"},{"num":4,"location":"someFile.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"}]}`);
		});

		// The reasoning behind this sorting order is so that the Table view can function as a "show me all the violations
		// in File X" option.
		it('Results are sorted by severity, then file, then location', async () => {
			// ==== SETUP ====
			// Populate the engine with:
			const violations: Violation[] = [
				// A low-severity violation late in a high-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_A, 20, 1),
				// A low-severity violation early in the same high-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_A, 1, 1),
				// A low-severity violation early in a low-alphabetical file.
				createViolation(rule1.name, PATH_TO_FILE_Z, 1, 1),
				// A high-severity violation later in the same low-alphabetical file.
				createViolation(rule2.name, PATH_TO_FILE_Z, 20, 1)
			];
			engine1.resultsToReturn = {violations};
			const workspace = await codeAnalyzerCore.createWorkspace(['package.json']);
			const rules = await codeAnalyzerCore.selectRules(['all'], {workspace});
			const results = await codeAnalyzerCore.run(rules, {workspace});

			// ==== TESTED BEHAVIOR ====
			viewer.view(results);

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(4);
			expect(displayEvents[0].type).toEqual(DisplayEventType.LOG);
			expect(displayEvents[0].data).toEqual('');
			expect(displayEvents[1].type).toEqual(DisplayEventType.LOG);
			expect(displayEvents[1].data).toEqual(getMessage(BundleName.ResultsViewer, 'summary.shared.results-relative-to', [PATH_TO_SAMPLE_CODE]));
			expect(displayEvents[2].type).toEqual(DisplayEventType.TABLE);
			expect(displayEvents[2].data).toEqual(`{"columns":["#","Severity","Rule","Location","Message"],"rows":[{"num":1,"location":"fileZ.cls:20:1","rule":"stubEngine1:stub1RuleB","severity":"2 (High)","message":"This is a message"},{"num":2,"location":"fileA.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"},{"num":3,"location":"fileA.cls:20:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"},{"num":4,"location":"fileZ.cls:1:1","rule":"stubEngine1:stub1RuleA","severity":"4 (Low)","message":"This is a message"}]}`);
		});
	});
});

describe('Tests for the findLongestCommonParentFolderOf helper function', () => {
	it('When a single file is given, then its direct parent is returned', () => {
		expect(findLongestCommonParentFolderOf([path.resolve(import.meta.dirname,'ResultsViewer.test.ts')])).toEqual(import.meta.dirname);
	});

	it('When paths share common parent folders, then longest common folder is returned', () => {
		const path1 = path.resolve(import.meta.dirname,'..','actions','RunAction.test.ts');
		const path2 = path.resolve(import.meta.dirname,'ResultsViewer.test.ts');
		const path3 = path.resolve(import.meta.dirname,'..','actions','RulesAction.test.ts');
		expect(findLongestCommonParentFolderOf([path1, path2, path3])).toEqual(path.resolve(import.meta.dirname,'..'));
	});

	if(os.platform() === 'win32') { // The following tests only run on Windows machines
		it('When paths do not share common root (which can happen on Windows machines), then empty string is returned', () => {
			const path1 = 'C:\\Windows\\someFile.txt';
			const path2 = 'D:\\anotherFile.txt';
			expect(findLongestCommonParentFolderOf([path1, path2])).toEqual('');
		});

		it('When windows paths share common root only, then common root is returned', () => {
			const path1 = 'C:\\Windows\\someFile.txt';
			const path2 = 'C:\\Users\\anotherFile.txt';
			expect(findLongestCommonParentFolderOf([path1, path2])).toEqual('C:\\');
		});
	} else { // The following test only runs on Unix-based machines
		it('When unix paths share common root only, then common root is returned', () => {
			const path1 = '/temp/someFile.txt';
			const path2 = '/Users/anotherFile.txt';
			expect(findLongestCommonParentFolderOf([path1, path2])).toEqual('/');
		});
	}
});

function createViolation(ruleName: string, file: string, startLine: number, startColumn: number, resourceUrls: string[] = []): Violation {
	return {
		ruleName,
		message: 'This is a message',
		codeLocations: [{
			file,
			startLine,
			startColumn
		}],
		primaryLocationIndex: 0,
		resourceUrls: resourceUrls
	};
}

function repeatViolation(violation: Violation, times: number): Violation[] {
	return Array(times).fill(violation);
}

function readComparisonFile(fileName: string): Promise<string> {
	return fs.promises.readFile(path.join(PATH_TO_COMPARISON_FILES, fileName), {encoding: 'utf-8'});
}
