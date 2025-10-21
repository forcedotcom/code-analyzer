import * as path from 'node:path';
import {Ux} from '@salesforce/sf-plugins-core';
import {CodeLocation, RunResults, SeverityLevel, Violation} from '@salesforce/code-analyzer-core';
import {Display} from '../Display.js';
import {toStyledHeaderAndBody} from '../utils/StylingUtil.js';
import {BundleName, getMessage} from '../messages.js';

export interface ResultsViewer {
	view(results: RunResults): void;
}

export class ResultsNoOpDisplayer implements ResultsViewer {
	public view(_results: RunResults): void {
		// istanbul ignore next - No need to cover deliberate no-op
		return;
	}
}

abstract class AbstractResultsDisplayer implements ResultsViewer {
	protected display: Display;

	public constructor(display: Display) {
		this.display = display;
	}

	public view(results: RunResults): void {
		if (results.getViolationCount() === 0) {
			return;
		} else {
			this.displayLineSeparator();
			this._view(results);
			this.displayLineSeparator();
		}
	}

	protected displayLineSeparator(): void {
		this.display.displayLog('');
	}

	protected abstract _view(results: RunResults): void;
}

export class ResultsDetailDisplayer extends AbstractResultsDisplayer {
	protected _view(results: RunResults): void {
		const violations = sortViolations(results.getViolations());
		const runDir: string = results.getRunDirectory();
		this.display.displayLog(getMessage(BundleName.ResultsViewer, 'summary.shared.results-relative-to', [runDir]) + "\n");
		this.displayDetails(violations, runDir);
	}

	private displayDetails(violations: Violation[], runDir: string): void {
		const styledViolations: string[] = violations
			.map((violation, idx) => this.styleViolation(violation, idx, runDir));
		this.display.displayLog(styledViolations.join('\n\n'));
	}

	private styleViolation(violation: Violation, idx: number, runDir: string): string {
		const rule = violation.getRule();
		const sev = rule.getSeverityLevel();

		const header = getMessage(
			BundleName.ResultsViewer,
			'summary.detail.violation-header',
			[idx + 1, rule.getName()]
		);
		const body = {
			severity: `${sev.valueOf()} (${SeverityLevel[sev]})`,
			engine: rule.getEngineName(),
			message: violation.getMessage()
		}
		const keys: string[] = ['severity', 'engine', 'message'];
		if (violation.getCodeLocations().length == 1) {
			body['location'] = stringifyLocation(violation.getCodeLocations()[0], false, runDir);
			keys.push('location');
		} else if (violation.getCodeLocations().length > 1) {
			body['locations'] = stringifyLocations(violation.getCodeLocations(), violation.getPrimaryLocationIndex(), runDir);
			keys.push('locations');
		}
		if (violation.getResourceUrls().length == 1) {
			body['resource'] = violation.getResourceUrls()[0];
			keys.push('resource');
		} else if (violation.getResourceUrls().length > 1) {
			body['resources'] = violation.getResourceUrls();
			keys.push('resources');
		}
		return toStyledHeaderAndBody(header, body, keys);
	}
}

function stringifyLocations(codeLocations: CodeLocation[], primaryIndex: number, runDir: string): string[] {
	return codeLocations.map((loc, idx) =>
		stringifyLocation(loc, codeLocations.length > 1 && primaryIndex === idx, runDir));
}

function stringifyLocation(loc: CodeLocation, displayMain: boolean, runDir: string): string {
	const mainPortion: string = displayMain ? '(main) ' : '';
	let filePortion: string | undefined = loc.getFile();
	if (filePortion && filePortion.startsWith(runDir)) {
		filePortion = filePortion.slice(runDir.length);
	}
	let rangePortion: string = '';
	if (loc.getStartLine()) {
		rangePortion += ` (${loc.getStartLine()}:${loc.getStartColumn() || 1}`;
		if (loc.getEndLine()) {
			rangePortion += `-${loc.getEndLine()}:${loc.getEndColumn() || 1}`;
		}
		rangePortion += ')';
	}
	const commentPortion: string = loc.getComment() ? ` "${loc.getComment()}"` : '';

	return `${mainPortion}${filePortion}${rangePortion}${commentPortion}`;
}

type ResultRow = {
	num: number;
	location: string;
	rule: string;
	severity: string;
	message: string;
}

const TABLE_COLUMNS: Ux.Table.Columns<ResultRow> = {
	num: {
		header: getMessage(BundleName.ResultsViewer, 'summary.table.num-column'),
	},
	severity: {
		header: getMessage(BundleName.ResultsViewer, 'summary.table.severity-column')
	},
	rule: {
		header: getMessage(BundleName.ResultsViewer, 'summary.table.rule-column')
	},
	location: {
		header: getMessage(BundleName.ResultsViewer, 'summary.table.location-column')
	},
	message: {
		header: getMessage(BundleName.ResultsViewer, 'summary.table.message-column')
	}
};

export class ResultsTableDisplayer extends AbstractResultsDisplayer {
	protected _view(results: RunResults) {
		const violations: Violation[] = sortViolations(results.getViolations());
		const parentFolder: string = findLongestCommonParentFolderOf(violations.map(v =>
			v.getPrimaryLocation().getFile()).filter(f => f !== undefined));

		const resultRows: ResultRow[] = violations.map((v, idx) => {
				const severity = v.getRule().getSeverityLevel();
				const primaryLocation: CodeLocation = v.getPrimaryLocation();
				const relativeFile: string | null = primaryLocation.getFile() ?
					path.relative(parentFolder, primaryLocation.getFile()!) : null;
				return {
					num: idx + 1,
					location: `${relativeFile}:${primaryLocation.getStartLine()}:${primaryLocation.getStartColumn()}`,
					rule: `${v.getRule().getEngineName()}:${v.getRule().getName()}`,
					severity: `${severity.valueOf()} (${SeverityLevel[severity]})`,
					message: v.getMessage()
				}
			});

		this.display.displayLog(getMessage(BundleName.ResultsViewer, 'summary.shared.results-relative-to', [parentFolder]));
		this.display.displayTable(resultRows, TABLE_COLUMNS);
	}
}

function sortViolations(violations: Violation[]): Violation[] {
	return violations.toSorted((v1, v2) => {
		// First compare severities.
		const v1Sev = v1.getRule().getSeverityLevel();
		const v2Sev = v2.getRule().getSeverityLevel();
		if (v1Sev !== v2Sev) {
			return v1Sev - v2Sev;
		}
		// Next, compare file names.
		const v1PrimaryLocation = v1.getCodeLocations()[v1.getPrimaryLocationIndex()];
		const v2PrimaryLocation = v2.getCodeLocations()[v2.getPrimaryLocationIndex()];
		const v1File = v1PrimaryLocation.getFile() || /* istanbul ignore next */ '';
		const v2File = v2PrimaryLocation.getFile() || /* istanbul ignore next */ '';
		if (v1File !== v2File) {
			return v1File.localeCompare(v2File);
		}

		// Next, compare start lines.
		const v1StartLine = v1PrimaryLocation.getStartLine() || /* istanbul ignore next */ 0;
		const v2StartLine = v2PrimaryLocation.getStartLine() || /* istanbul ignore next */ 0;
		if (v1StartLine !== v2StartLine) {
			return v1StartLine - v2StartLine;
		}

		// Next, compare start columns.
		const v1StartColumn = v1PrimaryLocation.getStartColumn() || /* istanbul ignore next */ 0;
		const v2StartColumn = v2PrimaryLocation.getStartColumn() || /* istanbul ignore next */ 0;
		return v1StartColumn - v2StartColumn;
	});
}

/**
 * Returns the longest comment parent folder of the file paths provided
 * Note that this function assumes that all the paths are indeed files and not folders
 */
export function findLongestCommonParentFolderOf(filePaths: string[]): string {
	const roots: string[] = filePaths.map(filePath => path.parse(filePath).root);
	const commonRoot: string = (new Set(roots)).size === 1 ? roots[0] : '';
	// istanbul ignore next - Hard to test outside of Windows
	if (!commonRoot) {
		return '';
	}
	const commonFolders: string[] = [];
	let depth: number = 0;
	const explodedPaths: string[][] = filePaths.map(file =>
		path.dirname(file).slice(commonRoot.length).split(path.sep).filter(v => v.length > 0));
	while(explodedPaths.every(folders => folders.length > depth)) {
		const currFolder: string = explodedPaths[0][depth];
		if (explodedPaths.some(folders => folders[depth] !== currFolder)) {
			break;
		}
		commonFolders.push(currFolder);
		depth++;
	}
	return path.join(commonRoot, ... commonFolders);
}
