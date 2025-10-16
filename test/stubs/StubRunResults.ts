import { EngineRunResults, RunResults, Violation, SeverityLevel, OutputFormat } from '@salesforce/code-analyzer-core';


export class StubEmptyResults implements RunResults {
    getCoreVersion(): string {
        throw new Error('Method not implemented.');
    }

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getRunDirectory(): string {
		throw new Error('Method not implemented.');
	}

	getViolationCount(): number {
		return 0;
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getViolationCountOfSeverity(severity: SeverityLevel): number {
		return 0;
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getViolations(): Violation[] {
		return [];
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getEngineNames(): string[] {
		return [];
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getEngineRunResults(_engineName: string): EngineRunResults {
		throw new Error('Method not implemented.');
	}

	/**
	 * Based on the way the tests currently use this stub, this method's return value matters less
	 * than the mere fact of its invocation, so it should be fine for it to return a weird string.
	 */
	toFormattedOutput(format: OutputFormat): string {
		return `Results formatted as ${format}`;
	}
}

export class StubNonEmptyResults implements RunResults {
    getCoreVersion(): string {
        throw new Error('Method not implemented.');
    }

	getRunDirectory(): string {
		throw new Error('Method not implemented.');
	}

	getViolationCount(): number {
		return 5;
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getViolationCountOfSeverity(severity: SeverityLevel): number {
		throw new Error('Method not implemented.');
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getViolations(): Violation[] {
		throw new Error('Method not implemented.');
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getEngineNames(): string[] {
		return [];
	}

	/**
	 * Based on the way the tests currently use this stub, this method is never called,
	 * so it should be fine for it to be unimplemented.
	 */
	getEngineRunResults(_engineName: string): EngineRunResults {
		throw new Error('Method not implemented.');
	}

	/**
	 * Based on the way the tests currently use this stub, this method's return value matters less
	 * than the mere fact of its invocation, so it should be fine for it to return a weird string.
	 */
	toFormattedOutput(format: OutputFormat): string {
		return `Results formatted as ${format}`;
	}
}
