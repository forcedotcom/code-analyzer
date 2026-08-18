import * as EngineApi from "@salesforce/code-analyzer-engine-api"
import {LogLevel} from "@salesforce/code-analyzer-engine-api"

/**
 * FunctionalStubEnginePlugin1 - A plugin stub with preconfigured outputs to help with testing
 */
export class FunctionalStubEnginePlugin1 extends EngineApi.EnginePluginV1 {
	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	getAvailableEngineNames(): string[] {
		return ["stubEngine1", "stubEngine2"];
	}

	createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		if (engineName == "stubEngine1") {
			this.createdEngines.set(engineName, new StubEngine1(config));
		} else if (engineName == "stubEngine2") {
			this.createdEngines.set(engineName, new StubEngine2(config));
		} else {
			throw new Error(`Unsupported engine name: ${engineName}`)
		}
		return Promise.resolve(this.getCreatedEngine(engineName));
	}

	getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName) as EngineApi.Engine;
		}
		throw new Error(`Engine with name ${engineName} has not yet been created`);
	}
}

/**
 * ConfigurableStubEnginePlugin1 - A plugin that can accept pre-created engines in place of calling {@link createEngine} on hard-coded engines.
 */
export class ConfigurableStubEnginePlugin1 extends EngineApi.EnginePluginV1 {
	private createdEngines: Map<string, EngineApi.Engine> = new Map();

	addEngine(engine: EngineApi.Engine): void {
		this.createdEngines.set(engine.getName(), engine);
	}

	getAvailableEngineNames(): string[] {
		// Return the names of whatever engines we've been configured with.
		return [...this.createdEngines.keys()];
	}

	createEngine(engineName: string, _config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		// The engines have already been created, so just check whether we have it.
		if (!this.createdEngines.has(engineName)) {
			throw new Error(`Plugin not preconfigured with engine ${engineName}`);
		}
		return Promise.resolve(this.createdEngines.get(engineName) as EngineApi.Engine);
	}
}

/**
 * StubEngine1 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine1 extends EngineApi.Engine {
	readonly config: EngineApi.ConfigObject;
	readonly runRulesCallHistory: {ruleNames: string[], runOptions: EngineApi.RunOptions}[] = [];
	resultsToReturn: EngineApi.EngineRunResults = { violations: [] }

	constructor(config: EngineApi.ConfigObject) {
		super();
		this.config = config;
	}

	getName(): string {
		return "stubEngine1";
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.0");
	}

	describeRules(): Promise<EngineApi.RuleDescription[]> {
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 0
		});
		this.emitTelemetryEvent('engine1DescribeTelemetry', {
			someArg: true
		});
		this.emitEvent<EngineApi.LogEvent>({
			type: EngineApi.EventType.LogEvent,
			message: "someMiscFineMessageFromStubEngine1",
			logLevel: LogLevel.Fine
		});
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 50
		});
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 100
		});
		return Promise.resolve([
			{
				name: "stub1RuleA",
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["Recommended", "CodeStyle"],
				description: "Some description for stub1RuleA",
				resourceUrls: ["https://example.com/stub1RuleA"]
			},
			{
				name: "stub1RuleB",
				severityLevel: EngineApi.SeverityLevel.High,
				tags: ["Recommended", "Security"],
				description: "Some description for stub1RuleB",
				resourceUrls: ["https://example.com/stub1RuleB"]
			},
			{
				name: "stub1RuleC",
				severityLevel: EngineApi.SeverityLevel.Moderate,
				tags: ["Recommended", "Performance", "Custom"],
				description: "Some description for stub1RuleC",
				resourceUrls: ["https://example.com/stub1RuleC"]
			},
			{
				name: "stub1RuleD",
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["CodeStyle"],
				description: "Some description for stub1RuleD",
				resourceUrls: ["https://example.com/stub1RuleD"]
			},
			{
				name: "stub1RuleE",
				severityLevel: EngineApi.SeverityLevel.Moderate,
				tags: ["Performance"],
				description: "Some description for stub1RuleE",
				resourceUrls: ["https://example.com/stub1RuleE", "https://example.com/stub1RuleE_2"]
			}
		]);
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		this.runRulesCallHistory.push({ruleNames, runOptions});
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 0
		});
		this.emitTelemetryEvent('engine1ExecuteTelemetry', {
			someArg: true
		});
		this.emitEvent<EngineApi.LogEvent>({
			type: EngineApi.EventType.LogEvent,
			message: "someMiscFineMessageFromStubEngine1",
			logLevel: LogLevel.Fine
		});
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 50
		});
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 100
		});
		return Promise.resolve(this.resultsToReturn);
	}
}

/**
 * StubEngine2 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine2 extends EngineApi.Engine {
	readonly config: EngineApi.ConfigObject;
	readonly runRulesCallHistory: {ruleNames: string[], runOptions: EngineApi.RunOptions}[] = [];
	resultsToReturn: EngineApi.EngineRunResults = { violations: [] }

	constructor(config: EngineApi.ConfigObject) {
		super();
		this.config = config;
	}

	getName(): string {
		return "stubEngine2";
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.2.3");
	}

	describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([
			{
				name: "stub2RuleA",
				severityLevel: EngineApi.SeverityLevel.Moderate,
				tags: ["Recommended", "Security"],
				description: "Some description for stub2RuleA",
				resourceUrls: ["https://example.com/stub2RuleA"]
			},
			{
				name: "stub2RuleB",
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["Performance", "Custom"],
				description: "Some description for stub2RuleB",
				resourceUrls: ["https://example.com/stub2RuleB"]
			},
			{
				name: "stub2RuleC",
				severityLevel: EngineApi.SeverityLevel.High,
				tags: ["Recommended", "BestPractice"],
				description: "Some description for stub2RuleC",
				resourceUrls: [] // Purposely putting in nothing here
			}
		]);
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		this.runRulesCallHistory.push({ruleNames, runOptions});
		this.emitEvent<EngineApi.LogEvent>({
			type: EngineApi.EventType.LogEvent,
			message: "someMiscInfoMessageFromStubEngine2",
			logLevel: LogLevel.Info
		});
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 5
		});
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 63
		});
		return Promise.resolve(this.resultsToReturn);
	}
}

/**
 * ThrowingStubPlugin1 - A plugin that throws an exception during a call to getAvailableEngineNames
 */
export class ThrowingStubPlugin1 extends EngineApi.EnginePluginV1 {
	getAvailableEngineNames(): string[] {
		throw new Error('SomeErrorFromGetAvailableEngineNames');
	}

	createEngine(_engineName: string, _config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		throw new Error('Should not be called');
	}
}

/**
 * TimeableStubEnginePlugin1 - A plugin whose associated engine can be given a time to wait between engine update events.
 */
export class TimeableStubEnginePlugin1 extends EngineApi.EnginePluginV1 {
	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	getAvailableEngineNames(): string[] {
		return ["timeableEngine1", "timeableEngine2"];
	}

	createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		if (engineName == "timeableEngine1") {
			this.createdEngines.set(engineName, new TimeableEngine1(config));
		} else if (engineName == "timeableEngine2") {
			this.createdEngines.set(engineName, new TimeableEngine2(config));
		} else {
			throw new Error(`Unsupported engine name: ${engineName}`)
		}
		return Promise.resolve(this.getCreatedEngine(engineName));
	}

	getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName) as EngineApi.Engine;
		}
		throw new Error(`Engine with name ${engineName} has not yet been created`);
	}
}

abstract class BaseTimeableEngine extends EngineApi.Engine {
	private selectionWaitTime: number;
	private executionWaitTime: number;

	constructor(_config: EngineApi.ConfigObject) {
		super();
		this.selectionWaitTime = 0;
		this.executionWaitTime = 0;
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.1");
	}

	setRuleSelectionWaitTime(waitTime: number): void {
		this.selectionWaitTime = waitTime;
	}

	setEngineExecutionWaitTime(waitTime: number) {
		this.executionWaitTime = waitTime;
	}

	async describeRules(): Promise<EngineApi.RuleDescription[]> {
		await new Promise(res => setTimeout(res, this.selectionWaitTime));
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 0
		});
		await new Promise(res => setTimeout(res, this.selectionWaitTime));
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 40
		});
		await new Promise(res => setTimeout(res, this.selectionWaitTime));
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 60
		});
		await new Promise(res => setTimeout(res, this.selectionWaitTime));
		this.emitEvent<EngineApi.DescribeRulesProgressEvent>({
			type: EngineApi.EventType.DescribeRulesProgressEvent,
			percentComplete: 100
		});
		return [
			{
				name: "stub1RuleA",
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["Recommended", "CodeStyle"],
				description: "Some description for stub1RuleA",
				resourceUrls: ["https://example.com/stub1RuleA"]
			}
		];
	}

	async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		await new Promise(res => setTimeout(res, this.executionWaitTime));
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 0
		});
		await new Promise(res => setTimeout(res, this.executionWaitTime));
		this.emitEvent<EngineApi.LogEvent>({
			type: EngineApi.EventType.LogEvent,
			message: "someMiscFineMessageFromStubEngine1",
			logLevel: LogLevel.Fine
		});
		await new Promise(res => setTimeout(res, this.executionWaitTime));
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 50
		});
		await new Promise(res => setTimeout(res, this.executionWaitTime));
		this.emitEvent<EngineApi.RunRulesProgressEvent>({
			type: EngineApi.EventType.RunRulesProgressEvent,
			percentComplete: 100
		});
		await new Promise(res => setTimeout(res, this.executionWaitTime));
		return Promise.resolve({violations: []});
	}
}

/**
 * TimeableEngine1 - An engine with {@code setRuleSelectionWaitTime()} and {@code setRuleExecutionWaitTime()} methods,
 * allowing delays to be added between update events.
 */
export class TimeableEngine1 extends BaseTimeableEngine {
	getName(): string {
		return "timeableEngine1";
	}
}

/**
 * TimeableEngine2 - An engine with {@code setRuleSelectionWaitTime()} and {@code setRuleExecutionWaitTime()} methods,
 * allowing delays to be added between update events.
 */
export class TimeableEngine2 extends BaseTimeableEngine {
	getName(): string {
		return "timeableEngine2";
	}
}

/**
 * EventConfigurableEngine1 - An engine with a {@code setWaitTime()} method allowing a delay to be added between update events.
 */
export class EventConfigurableEngine1 extends EngineApi.Engine {
	private logEvents: {logLevel: LogLevel, message: string}[] = [];
	private runProgressEvents: {percentComplete: number, message?: string}[] = [];

	constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	getName(): string {
		return "eventConfigurableEngine1";
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.5");
	}

	addLogEvents(...events: {logLevel: LogLevel, message: string}[]): void {
		this.logEvents = [...this.logEvents, ...events];
	}

	addRunProgressEvents(...events: {percentComplete: number, message?: string}[]): void {
		this.runProgressEvents = [...this.runProgressEvents, ...events];
	}

	describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([
			{
				name: "stub1RuleA",
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["Recommended", "CodeStyle"],
				description: "Some description for stub1RuleA",
				resourceUrls: ["https://example.com/stub1RuleA"]
			}
		]);
	}

	async runRules(_ruleNames: string[], _runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		for (const {logLevel, message} of this.logEvents) {
			this.emitEvent<EngineApi.LogEvent>({
				type: EngineApi.EventType.LogEvent,
				message,
				logLevel
			});
		}
		for (const {percentComplete, message} of this.runProgressEvents) {
			this.emitRunRulesProgressEvent(percentComplete, message);
		}
		return Promise.resolve({violations: []});
	}
}

export class StubEnginePluginWithTargetDependentEngine extends EngineApi.EnginePluginV1 {
	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	getAvailableEngineNames(): string[] {
		return ['targetDependentEngine1'];
	}

	createEngine(engineName: string, config: EngineApi.ConfigObject): Promise<EngineApi.Engine> {
		if (engineName === 'targetDependentEngine1') {
			this.createdEngines.set(engineName, new TargetDependentEngine1(config));
		} else {
			throw new Error(`Unsupported engine name: ${engineName}`);
		}
		return Promise.resolve(this.getCreatedEngine(engineName));
	}

	getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName) as EngineApi.Engine;
		}
		throw new Error(`Engine with name ${engineName} has not yet been created.`);
	}
}


export class StubApexGuruEngine extends EngineApi.Engine {
	readonly runRulesCallHistory: {ruleNames: string[], runOptions: EngineApi.RunOptions}[] = [];
	resultsToReturn: EngineApi.EngineRunResults = { violations: [] }

	constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	getName(): string {
		return "apexguru";
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.0.0");
	}

	describeRules(): Promise<EngineApi.RuleDescription[]> {
		return Promise.resolve([
			{
				name: "stubApexGuruRuleA",
				severityLevel: EngineApi.SeverityLevel.High,
				tags: ["Recommended", "Performance"],
				description: "Some description for stubApexGuruRuleA",
				resourceUrls: ["https://example.com/stubApexGuruRuleA"]
			}
		]);
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		this.runRulesCallHistory.push({ruleNames, runOptions});
		return Promise.resolve(this.resultsToReturn);
	}
}

export class TargetDependentEngine1 extends EngineApi.Engine {
	readonly runRulesCallHistory: {ruleNames: string[], runOptions: EngineApi.RunOptions}[] = [];
	constructor(_config: EngineApi.ConfigObject) {
		super();
	}

	getName(): string {
		return 'targetDependentEngine1';
	}

	getEngineVersion(): Promise<string> {
		return Promise.resolve("1.3.0");
	}

	async describeRules(describeOptions: EngineApi.DescribeOptions): Promise<EngineApi.RuleDescription[]> {
		if (!describeOptions.workspace) {
			return Promise.resolve([]);
		}
		// Derive a rule for each of the targeted files.
		return (await describeOptions.workspace.getTargetedFiles()).map(fileOrFolder => {
			return {
				name: `ruleFor${fileOrFolder}`,
				severityLevel: EngineApi.SeverityLevel.Low,
				tags: ["Recommended"],
				description: `Rule synthesized for target "${fileOrFolder}`,
				resourceUrls: [`https://example.com/${fileOrFolder}`]
			}
		});
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
		this.runRulesCallHistory.push({ruleNames, runOptions});
		return Promise.resolve({violations: []});
	}
}
