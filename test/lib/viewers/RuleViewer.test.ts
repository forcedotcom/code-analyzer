import * as fs from 'node:fs';
import * as path from 'node:path';
import ansis from 'ansis';
import {RuleDetailDisplayer, RulesNoOpDisplayer, RuleTableDisplayer} from '../../../src/lib/viewers/RuleViewer.js';
import {DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay.js';
import * as StubRules from '../../stubs/StubRules.js';

const PATH_TO_COMPARISON_FILES = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'comparison-files', 'lib',
	'viewers', 'RuleViewer.test.ts');

describe('RuleViewer implementations', () => {
	describe('RuleDetailDisplayer', () => {
		it('When given no rules, outputs a line separator and nothing else', () => {
			const display = new SpyDisplay();
			const viewer = new RuleDetailDisplayer(display);

			viewer.view([]);

			const displayEvents = display.getDisplayEvents();
			expect(displayEvents).toHaveLength(1);
			expect(displayEvents).toEqual([{
				type: DisplayEventType.LOG,
				data: ''
			}]);
		});

		it('When given one rule, outputs correct summary and correctly styled rule data', () => {
			const display = new SpyDisplay();
			const viewer = new RuleDetailDisplayer(display);
			const rule = new StubRules.StubRule1();

			viewer.view([
				rule
			]);

			const actualDisplayEvents = display.getDisplayEvents();
			expect(actualDisplayEvents).toHaveLength(3);
			for (const displayEvent of actualDisplayEvents) {
				expect(displayEvent.type).toEqual(DisplayEventType.LOG);
			}
			// Rip off all of ansis's styling, so we're just comparing plain text.
			const actualEventText = ansis.strip(actualDisplayEvents.map(e => e.data).join('\n'));

			const expectedRuleDetails = readComparisonFile('one-rule-details.txt');
			expect(actualEventText).toEqual(expectedRuleDetails);
		});

		it('When given multiple rules, outputs correct summary and correctly styled rule data', () => {
			const display = new SpyDisplay();
			const viewer = new RuleDetailDisplayer(display);
			const rule1 = new StubRules.StubRule1();
			const rule2 = new StubRules.StubRule2();

			viewer.view([
				rule1,
				rule2
			]);

			const actualDisplayEvents = display.getDisplayEvents();
			expect(actualDisplayEvents).toHaveLength(3);
			for (const displayEvent of actualDisplayEvents) {
				expect(displayEvent.type).toEqual(DisplayEventType.LOG);
			}
			// Rip off all of ansis's styling, so we're just comparing plain text.
			const actualEventText = ansis.strip(actualDisplayEvents.map(e => e.data).join('\n'));

			const expectedRuleDetails = readComparisonFile('two-rules-details.txt');
			expect(actualEventText).toEqual(expectedRuleDetails);
		});
	});

	describe('RuleTableDisplayer', () => {
		it('When given no rules, outputs summary and nothing else', () => {
			const display = new SpyDisplay();
			const viewer = new RuleTableDisplayer(display);

			viewer.view([]);

			const displayEvents = display.getDisplayEvents();
			expect(displayEvents).toHaveLength(1);
			expect(displayEvents).toEqual([{
				type: DisplayEventType.LOG,
				data: ''
			}]);
		});

		it('When given one rule, outputs correct summary and rule data', () => {
			const display = new SpyDisplay();
			const viewer = new RuleTableDisplayer(display);
			const rule = new StubRules.StubRule1();

			viewer.view([
				rule
			]);

			const displayEvents = display.getDisplayEvents();
			expect(displayEvents).toHaveLength(3);
			expect(displayEvents).toEqual([{
				type: DisplayEventType.LOG,
				data: ''
			}, {
				type: DisplayEventType.TABLE,
				data: JSON.stringify({
					columns: ['#', 'Name', 'Engine', 'Severity', 'Tag'],
					rows: [{
						num: 1,
						name: rule.getName(),
						engine: rule.getEngineName(),
						severity: rule.getFormattedSeverity(),
						tag: rule.getFormattedTags()
					}]
				})
			}, {
				type: DisplayEventType.LOG,
				data: ''
			}])
		});

		it('When given multiple rules, outputs correct summary and rule data', () => {
			const display = new SpyDisplay();
			const viewer = new RuleTableDisplayer(display);
			const rule1 = new StubRules.StubRule1();
			const rule2 = new StubRules.StubRule2();

			viewer.view([
				rule1,
				rule2
			]);

			const displayEvents = display.getDisplayEvents();
			expect(displayEvents).toHaveLength(3);
			expect(displayEvents).toEqual([{
				type: DisplayEventType.LOG,
				data: ''
			}, {
				type: DisplayEventType.TABLE,
				data: JSON.stringify({
					columns: ['#', 'Name', 'Engine', 'Severity', 'Tag'],
					rows: [{
						num: 1,
						name: rule1.getName(),
						engine: rule1.getEngineName(),
						severity: rule1.getFormattedSeverity(),
						tag: rule1.getFormattedTags()
					}, {
						num: 2,
						name: rule2.getName(),
						engine: rule2.getEngineName(),
						severity: rule2.getFormattedSeverity(),
						tag: rule2.getFormattedTags()
					}]
				})
			}, {
				type: DisplayEventType.LOG,
				data: ''
			}]);
		});
	});

	describe('RuleNoopDisplayer', () => {
		it('Does not display', () => {
			const display = new SpyDisplay();
			const viewer = new RulesNoOpDisplayer();

			viewer.view([]);

			const displayEvents = display.getDisplayEvents();
			expect(displayEvents).toHaveLength(0);
		});
	})
});

function readComparisonFile(fileName: string): string {
	return fs.readFileSync(path.join(PATH_TO_COMPARISON_FILES, fileName), {encoding: 'utf-8'});
}
