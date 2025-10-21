import {
	CodeAnalyzer,
	EngineTelemetryEvent,
	EventType,
	TelemetryEvent
} from '@salesforce/code-analyzer-core';
import {TelemetryEmitter} from '../Telemetry.js';
import * as constants from '../../Constants.js';

export class TelemetryEventListener {
	private telemetryEmitter: TelemetryEmitter;

	public constructor(telemetryEmitter: TelemetryEmitter) {
		this.telemetryEmitter = telemetryEmitter;
	}

	public listen(codeAnalyzer: CodeAnalyzer): void {
		// Set up listeners.
		codeAnalyzer.onEvent(EventType.TelemetryEvent, (e: TelemetryEvent) => this.handleEvent('Core', e));
		codeAnalyzer.onEvent(EventType.EngineTelemetryEvent,  (e: EngineTelemetryEvent) => this.handleEvent(e.engineName, e));
	}

	public stopListening(): void {
		// Intentional no-op, because no cleanup is required.
	}

	private handleEvent(source: string, event: TelemetryEvent|EngineTelemetryEvent): void {
		return this.telemetryEmitter.emitTelemetry(source, constants.TelemetryEventName, {
			...event.data,
			sfcaEvent: event.eventName,
			timestamp: event.timestamp.getTime(),
			uuid: event.uuid
		});
	}
}
