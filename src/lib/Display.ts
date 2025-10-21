import {TableOptions} from '@oclif/table';
import {Spinner} from '@salesforce/sf-plugins-core';

/**
 * Interface for objects that display output information to users. E.g., a class that prints to the CLI would implement
 * this interface.
 * Contrast with a {@code Viewer} implementation, e.g. {@link RuleViewer}, which is responsible for arranging data and
 * handing it off to an underlying {@code Display} implementation.
 */
export interface Display {

	/**
	 * Outputs message to stdout at error-level (non-blocking) only if the "--json" flag is not present.
	 */
	displayError(msg: string): void;

	/**
	 * Output message to stdout at warning-level (non-blocking) only if the "--json" flag is not present.
	 */
	displayWarning(msg: string): void;

	/**
	 * Output message to stdout at info-level (non-blocking) only if the "--json" flag is not present.
	 */
	displayInfo(msg: string): void;

	/**
	 * Output message to stdout at log-level (non-blocking) only if the "--json" flag is not present.
	 */
	displayLog(msg: string): void;

	/**
	 * Output table to stdout only if the "--json" flag is not present.
	 */
	displayTable<R extends Record<string, unknown>>(options: TableOptions<R>): void;

	/**
	 * Prompt the user to confirm that the described action should be carried out, and block until they respond (or a timeout
	 * elapses). Resolves to {@code true} if the user confirms, or {@code false} if they don't.
	 */
	confirm(message: string): Promise<boolean>;

	spinnerStart(msg: string, status?: string): void;

	spinnerUpdate(status: string): void;

	spinnerStop(status: string): void;
}

export class UxDisplay implements Display {
	private readonly displayable: Displayable;
	private readonly spinner: Spinner;

	public constructor(displayable: Displayable, spinner: Spinner) {
		this.displayable = displayable;
		this.spinner = spinner;
	}

	public displayError(msg: string): void {
		// Setting "exit" to false means that the error will be displayed in a non-halting fashion instead of killing
		// the transaction entirely.
		this.displayable.error(msg, {exit: false});
	}

	public displayWarning(msg: string): void {
		this.displayable.warn(msg);
	}

	public displayInfo(message: string): void {
		this.displayable.info(message);
	}

	public displayLog(message: string): void {
		this.displayable.log(message);
	}

	public displayTable<R extends Record<string, unknown>>(options: TableOptions<R>): void {
		// Currently oclif's table options do not allow us to set the width of the table larger than the user's current
		// terminal width. This means if the user's terminal width is small then we will table cells with "truncate" by
		// default or "wrap" depending on the passed in 'overflow' value in the table options. To work around this 
		// limitation, we temporarily set the OCLIF_TABLE_COLUMN_OVERRIDE environment variable so that the user's
		// terminal width is ignored so that no truncating or wrapping occurs in order to maintain our original table
		// view behavior (prior to when we upgraded oclif).
		const oldTableColumnOverrideValue = process.env.OCLIF_TABLE_COLUMN_OVERRIDE;

		// If we use too large a number (like 99999), then we can get out of memory issues. Using 3000 seems to the best
		// number that fits everything without causing memory issues. And if there is more than 3000 characters then at
		// that point we are fine wrapping or truncating
		process.env.OCLIF_TABLE_COLUMN_OVERRIDE = '3000';
		try {
			this.displayable.table(options);
		} finally {
			process.env.OCLIF_TABLE_COLUMN_OVERRIDE = oldTableColumnOverrideValue;
		}
	}

	public confirm(message: string): Promise<boolean> {
		return this.displayable.confirm({message});
	}

	public spinnerStart(msg: string, status?: string): void {
		this.spinner.start(msg, status);
	}

	public spinnerUpdate(status: string): void {
		this.spinner.status = status;
	}

	public spinnerStop(status: string): void {
		this.spinner.stop(status);
	}
}

export interface Displayable {
	/**
	 * Output message to stdout at error-level (non-blocking) only when "--json" flag is not present. [Implemented by Command]
	 * @param options.exit If true, the message will be thrown as an error instead of logged. Default value = true.
	 */
	error(message: string, options: {exit: boolean}): void;

	// Output message to stdout at warning-level (non-blocking) only when "--json" flag is not present. [Implemented by SfCommand]
	warn(message: string): void;

	// Output message to stdout at info-level (non-blocking) only when "--json" flag is not present. [Implemented by SfCommand]
	info(message: string): void;

	// Output message to stdout at log-level (non-blocking) only when "--json" flag is not present.  [Implemented by Command]
	log(message?: string): void;

	// Prompt the user to confirm that the described action should be performed.                     [Implemented by SfCommand]
	confirm(promptInputs: {message: string}): Promise<boolean>;

	// Output table to stdout only when "--json" flag is not present.                                [Implemented by SfCommand]
	table<R extends Record<string, unknown>>(options: TableOptions<R>): void;
}
