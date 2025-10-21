import {TelemetryData} from '@salesforce/code-analyzer-core';
import {Lifecycle} from '@salesforce/core';

export interface TelemetryEmitter {
	emitTelemetry(source: string, eventName: string, data: TelemetryData): void;
}

export class SfCliTelemetryEmitter implements TelemetryEmitter {
	// istanbul ignore next - No sense in covering SF-CLI core code.
	public emitTelemetry(source: string, eventName: string, data: TelemetryData): void {
		return void Lifecycle.getInstance().emitTelemetry({
			...data,
			source,
			eventName
		});
	}
}
