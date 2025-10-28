import {
	CodeAnalyzer,
	EngineRunProgressEvent,
	EventType,
	RuleSelectionProgressEvent
} from '@salesforce/code-analyzer-core';
import {Display} from '../Display.js';
import {BundleName, getMessage} from '../messages.js';

export interface ProgressEventListener {
	listen(...codeAnalyzers: CodeAnalyzer[]): void;
	stopListening(): void;
}

abstract class ProgressSpinner {
	private readonly display: Display;
	private readonly tickTime: number;
	private tickIntervalId: NodeJS.Timeout;
	private _isSpinning: boolean;
	private startTime: number;

	protected constructor(display: Display, tickTime: number = 1000) {
		this.display = display;
		this.tickTime = tickTime;
		this._isSpinning = false;
	}

	protected startSpinning(action: string): void {
		/* istanbul ignore if: Shouldn't be possible for spinner to start twice */
		if (this._isSpinning) {
			return;
		}
		this.startTime = Date.now();
		this.display.spinnerStart(action, this.createInProgressSpinnerStatus());
		if (this.tickTime > 0) {
			// `setInterval` means the callback will be called repeatedly. This allows us to automatically refresh the
			// spinner on a regular interval even if nothing happened. This is primarily useful for incrementing a timer,
			// so the user doesn't feel like the system is frozen.
			this.tickIntervalId = setInterval(() => {
				this.display.spinnerUpdate(this.createInProgressSpinnerStatus());
			}, this.tickTime);
		}
		this._isSpinning = true;
	}

	protected updateSpinner(): void {
		this.display.spinnerUpdate(this.createInProgressSpinnerStatus());
	}

	protected stopSpinning(): void {
		if (this.tickIntervalId) {
			clearInterval(this.tickIntervalId);
		}
		if (this._isSpinning) {
			this.display.spinnerStop(this.createFinishedSpinnerStatus());
			this._isSpinning = false;
		}
	}

	protected isSpinning(): boolean {
		return this._isSpinning;
	}

	/**
	 * Return the number of seconds (rounded down) that the spinner has been spinning.
	 * @protected
	 */
	protected getSecondsSpentSpinning(): number {
		return Math.floor((Date.now() - this.startTime) / 1000);
	}

	protected abstract createInProgressSpinnerStatus(): string;

	protected abstract createFinishedSpinnerStatus(): string;
}

export class RuleSelectionProgressSpinner extends ProgressSpinner implements ProgressEventListener {
	private isListening: boolean;
	private engineNames: Set<string>;
	private readonly completionPercentages: number[];

	/**
	 * @param display The display with which to show output to the user
	 * @param tickTime A number of milliseconds to wait between automatic ticks. Defaults to 1000. Negative values disable ticking.
	 */
	public constructor(display: Display, tickTime: number = 1000) {
		super(display, tickTime);
		this.isListening = false;
		this.engineNames = new Set();
		this.completionPercentages = [];
	}

	public listen(...codeAnalyzers: CodeAnalyzer[]): void {
		/* istanbul ignore else: should not be calling listen() twice */
		if (!this.isListening) {
			this.isListening = true;
			codeAnalyzers.forEach((codeAnalyzer, idx) => {
				for (const engineName of codeAnalyzer.getEngineNames()) {
					this.engineNames.add(engineName);
				}
				this.completionPercentages.push(0);
				codeAnalyzer.onEvent(EventType.RuleSelectionProgressEvent, (e: RuleSelectionProgressEvent) => this.handleEvent(e, idx));
			});
		}
	}

	public stopListening(): void {
		if (this.isListening) {
			this.isListening = false;
			this.stopSpinning();
		}
	}

	private handleEvent(e: RuleSelectionProgressEvent, idx: number): void {
		if (!this.isListening) {
			return;
		}

		if (!this.isSpinning()) {
			this.startSpinning(getMessage(BundleName.ProgressEventListener, 'selection-spinner.action'));
		}

		this.completionPercentages[idx] = Math.floor(e.percentComplete);

		this.updateSpinner();
		// Since the events this spinner listens to have one aggregated completion percentage, we can (and should) stop
		// listening as soon as all Cores get their 100% event, instead of waiting for the `stopListening()` method.
		if (this.completionPercentages.every(p => p === 100)) {
			this.stopListening();
		}
	}

	protected createInProgressSpinnerStatus(): string {
		const aggregateCompletionPercentage: number =
			Math.floor(this.completionPercentages.reduce((prevTotal, next) => prevTotal + next, 0) / this.completionPercentages.length);
		return getMessage(BundleName.ProgressEventListener, 'selection-spinner.in-progress-status',
			[[...this.engineNames.keys()].join(', '), aggregateCompletionPercentage, this.getSecondsSpentSpinning()]);
	}

	protected createFinishedSpinnerStatus(): string {
		return getMessage(BundleName.ProgressEventListener, 'selection-spinner.finished-status');
	}
}

export class EngineRunProgressSpinner extends ProgressSpinner implements ProgressEventListener {
	private isListening: boolean;
	/**
	 * Mapping from each engine's name to a number indicating its completion percentage.
	 * @private
	 */
	private progressMap: Map<string, {percentComplete: number, message?: string}>;

	/**
	 * @param display The display with which to show output to the user
	 * @param tickTime A number of milliseconds to wait between automatic ticks. Defaults to 1000. Negative values disable ticking.
	 */
	public constructor(display: Display, tickTime: number = 1000) {
		super(display, tickTime);
		this.isListening = false;
	}

	public listen(...codeAnalyzers: CodeAnalyzer[]): void {
		if (codeAnalyzers.length > 1) {
			// It's technically possible to implement multiple-core support for this spinner, but not currently necessary.
			// So just throw a Developer Error if anyone tries.
			throw new Error('Developer Error: EngineRunProgressSpinner cannot listen to multiple Code Analyzers');
		}
		/* istanbul ignore else: should not be calling listen() twice */
		if (!this.isListening) {
			this.isListening = true;
			this.progressMap = new Map();
			codeAnalyzers[0].onEvent(EventType.EngineRunProgressEvent, (e: EngineRunProgressEvent) => this.handleEvent(e));
		}
	}

	public stopListening(): void {
		if (this.isListening) {
			this.isListening = false;
			this.stopSpinning();
		}
	}

	private handleEvent(e: EngineRunProgressEvent): void {
		/* istanbul ignore if: no event should be coming in after we're done listening */
		if (!this.isListening) {
			return;
		}

		// Update the progress map at the start so that the updated information is used in the next status.
		this.progressMap.set(e.engineName, {percentComplete: e.percentComplete, message: e.message});

		if (!this.isSpinning()) {
			this.startSpinning(getMessage(BundleName.ProgressEventListener, 'execution-spinner.action'));
		}
		this.updateSpinner();
	}

	protected createInProgressSpinnerStatus(): string {
		const secondsRunning = this.getSecondsSpentSpinning();
		const totalEngines = this.progressMap.size;
		let unfinishedEngines = 0;
		const engineLines: string[] = [];
		for (const [name, progress] of this.progressMap.entries()) {
			if (progress.percentComplete !== 100) {
				unfinishedEngines += 1;
			}
			if (progress.message) {
				engineLines.push(getMessage(BundleName.ProgressEventListener, 'execution-spinner.engine-progress-with-message', [name, progress.percentComplete, progress.message]));
			} else {
				engineLines.push(getMessage(BundleName.ProgressEventListener, 'execution-spinner.engine-progress', [name, progress.percentComplete]));
			}
		}
		return [
			getMessage(BundleName.ProgressEventListener, 'execution-spinner.progress-summary', [totalEngines - unfinishedEngines, totalEngines, secondsRunning]),
			...engineLines
		].join('\n');
	}

	protected createFinishedSpinnerStatus(): string {
		return getMessage(BundleName.ProgressEventListener, 'execution-spinner.finished-status',
			[[...this.progressMap.keys()].join(', ')]);
	}
}
