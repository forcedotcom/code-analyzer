
export enum View {
	DETAIL = 'detail',
	TABLE = 'table'
}

export const TelemetryEventName = 'plugin-code-analyzer';
export const TelemetrySource = 'CLI';

export const CliTelemetryEvents = {
	ENGINE_SELECTION: 'engine_selection',
	ENGINE_EXECUTION: 'engine_execution'
}

export const CliCommands = {
	RUN: 'run',
	RULES: 'rules',
	CONFIG: 'config',
	AST_DUMP: 'ast-dump'
}
