import { TableOptions } from '@oclif/table';
import {Display} from '../../src/lib/Display.js';

/**
 * Implementation of {@link Display} that tracks every call in an array and allows assertions against them.
 */
export class SpyDisplay implements Display {
	private displayEvents: DisplayEvent[] = [];

	private readonly confirmReturnValue: boolean;

	public constructor(confirmReturnValue: boolean = true) {
		this.confirmReturnValue = confirmReturnValue;
	}

	/**
	 * Track that the provided message was displayed as an Error-level output.
	 */
	public displayError(message: string): void {
		this.displayEvents.push({
			type: DisplayEventType.ERROR,
			data: message
		});
	}

	/**
	 * Track that the provided message was displayed as a Warn-level output.
	 */
	public displayWarning(message: string): void {
		this.displayEvents.push({
			type: DisplayEventType.WARN,
			data: message
		});
	}

	/**
	 * Track that the provided message was displayed as an Info-level output.
	 */
	public displayInfo(message: string): void {
		this.displayEvents.push({
			type: DisplayEventType.INFO,
			data: message
		});
	}

	public displayLog(message: string): void {
		this.displayEvents.push({
			type: DisplayEventType.LOG,
			data: message
		});
	}

	/**
	 * Track that the provided table data was displayed.
	 */
	public displayTable<R extends Record<string, unknown>>(options: TableOptions<R>): void {
		const columnNames: string[] = options.columns!.map(
			column => typeof(column) === 'string' ? column : (column as object)['name'] ?? (column as object)['key']);
		this.displayEvents.push({
			type: DisplayEventType.TABLE,
			data: JSON.stringify({
				columns: columnNames,
				rows: options.data
			})
		});
	}

	public confirm(message: string): Promise<boolean> {
		this.displayEvents.push({
			type: DisplayEventType.CONFIRM,
			data: message
		});
		return Promise.resolve(this.confirmReturnValue);
	}

	/**
	 * Track that the spinner was started with the provided message, and optionally status.
	 */
	public spinnerStart(msg: string, status?: string): void {
		this.displayEvents.push({
			type: DisplayEventType.SPINNER_START,
			data: JSON.stringify({
				msg,
				status
			})
		});
	}

	/**
	 * Track that the spinner was updated to the provided status.
	 */
	public spinnerUpdate(status: string): void {
		this.displayEvents.push({
			type: DisplayEventType.SPINNER_UPDATE,
			data: status
		});
	}

	/**
	 * Track that the spinner was stopped with the provided status.
	 * @param status
	 */
	public spinnerStop(status: string): void {
		this.displayEvents.push({
			type: DisplayEventType.SPINNER_STOP,
			data: status
		});
	}

	public getDisplayEvents(): DisplayEvent[] {
		return this.displayEvents;
	}
}

export enum DisplayEventType {
	ERROR,
	WARN,
	INFO,
	LOG,
	TABLE,
	CONFIRM,
	SPINNER_START,
	SPINNER_UPDATE,
	SPINNER_STOP
}

export type DisplayEvent = {
	type: DisplayEventType;
	data: string;
}
