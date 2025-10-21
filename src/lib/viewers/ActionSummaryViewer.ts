import {RuleSelection, RunResults, SeverityLevel, Violation} from '@salesforce/code-analyzer-core';
import {Display} from '../Display.js';
import {toStyledHeader, indent} from '../utils/StylingUtil.js';
import {BundleName, getMessage} from '../messages.js';

abstract class AbstractActionSummaryViewer {
	protected readonly display: Display;

	protected constructor(display: Display) {
		this.display = display;
	}

	public viewPreExecutionSummary(logFile: string): void {
		// Start with separator to cleanly break from anything that's already been logged.
		this.displayLineSeparator();
		this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'common.streaming-logs-to'));
		this.display.displayLog(indent(logFile));
		// End with a separator to cleanly break with anything that comes next.
		this.displayLineSeparator();
	}

	protected displaySummaryHeader(): void {
		this.display.displayLog(toStyledHeader(getMessage(BundleName.ActionSummaryViewer, 'common.summary-header')));
	}

	protected displayLineSeparator(): void {
		this.display.displayLog("");
	}

	protected displayLogFileInfo(logFile: string): void {
		this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'common.logfile-location'));
		this.display.displayLog(indent(logFile));
	}

	protected displayOutfiles(outfiles: string[], msgKey: string): void {
		this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, msgKey));
		for (const outfile of outfiles) {
			this.display.displayLog(indent(outfile));
		}
	}
}

export class ConfigActionSummaryViewer extends AbstractActionSummaryViewer {
	public constructor(display: Display) {
		super(display);
	}

	public viewPostExecutionSummary(logFile: string, outfile?: string): void {
		// Start with separator to cleanly break from anything that's already been logged.
		this.displayLineSeparator();
		this.displaySummaryHeader();
		this.displayLineSeparator();

		if (outfile) {
			this.displayOutfiles([outfile], 'config-action.outfile-location');
			this.displayLineSeparator();
		}

		this.displayLogFileInfo(logFile);
	}
}

export class RulesActionSummaryViewer extends AbstractActionSummaryViewer {
	public constructor(display: Display) {
		super(display);
	}

	public viewPostExecutionSummary(ruleSelection: RuleSelection, logFile: string, outfiles: string[]): void {
		// Start with separator to cleanly break from anything that's already been logged.
		this.displayLineSeparator();
		this.displaySummaryHeader();
		this.displayLineSeparator();

		const noRulesFound = ruleSelection.getCount() === 0;

		if (noRulesFound) {
			this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'rules-action.found-no-rules'));
		} else {
			this.displayRuleSelection(ruleSelection);
		}
		this.displayLineSeparator();

		if (outfiles.length > 0) {
			this.displayOutfiles(outfiles, 'rules-action.outfile-location');
			this.displayLineSeparator();
		}

		this.displayLogFileInfo(logFile);
	}

	private displayRuleSelection(ruleSelection: RuleSelection): void {
		this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'rules-action.rules-total', [ruleSelection.getCount(), ruleSelection.getEngineNames().length]));
		for (const engineName of ruleSelection.getEngineNames()) {
			const ruleCountForEngine: number = ruleSelection.getRulesFor(engineName).length;
			this.display.displayLog(indent(getMessage(BundleName.ActionSummaryViewer, 'rules-action.rules-item', [ruleCountForEngine, engineName])));
		}
	}
}

export class RunActionSummaryViewer extends AbstractActionSummaryViewer {
	public constructor(display: Display) {
		super(display);
	}

	public viewPostExecutionSummary(results: RunResults, logFile: string, outfiles: string[]): void {
		// Start with separator to cleanly break from anything that's already been logged.
		this.displayLineSeparator();
		this.displaySummaryHeader();
		this.displayLineSeparator();

		if (results.getViolationCount() === 0) {
			this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'run-action.found-no-violations'));
		} else {
			this.displayResultsSummary(results);
		}
		this.displayLineSeparator();

		if (outfiles.length > 0) {
			this.displayOutfiles(outfiles, 'run-action.outfiles-total');
			this.displayLineSeparator();
		}

		this.displayLogFileInfo(logFile);
	}

	private displayResultsSummary(results: RunResults): void {
		this.display.displayLog(getMessage(BundleName.ActionSummaryViewer, 'run-action.violations-total', [results.getViolationCount(), this.countUniqueFiles(results.getViolations())]));
		for (const sev of Object.values(SeverityLevel)) {
			// Some of the keys will be numbers, since the enum is numerical. Skip those.
			if (typeof sev !== 'string') {
				continue;
			}
			const sevCount = results.getViolationCountOfSeverity(SeverityLevel[sev] as SeverityLevel);
			if (sevCount > 0) {
				this.display.displayLog(indent(getMessage(BundleName.ActionSummaryViewer, 'run-action.violations-item', [sevCount, sev])));
			}
		}
	}

	private countUniqueFiles(violations: Violation[]): number {
		const fileSet: Set<string> = new Set();
		violations.forEach(v => {
			const primaryLocation = v.getCodeLocations()[v.getPrimaryLocationIndex()];
			const file = primaryLocation.getFile();
			if (file) {
				fileSet.add(file);
			}
		});
		return fileSet.size;
	}
}
