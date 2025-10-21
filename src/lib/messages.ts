import {Messages} from '@salesforce/core';
import {Tokens} from '@salesforce/core/lib/messages.js';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(import.meta.dirname);

export enum BundleName {
	ActionSummaryViewer = 'action-summary-viewer',
	ConfigCommand = 'config-command',
	ConfigModel = 'config-model',
	ConfigWriter = 'config-writer',
	PathStartUtil = 'path-start-util',
	ProgressEventListener = 'progress-event-listener',
	ResultsViewer = 'results-viewer',
	RuleViewer = 'rule-viewer',
	RulesCommand = 'rules-command',
	RulesWriter = 'rules-writer',
	ResultsWriter = 'results-writer',
	RunAction = 'run-action',
	RunCommand = 'run-command',
	Shared = 'shared',
	WorkspaceUtil = 'workspace-util'
}

class MessageCatalog {
	private readonly bundleMap: Map<BundleName, Messages<string>> = new Map();

	public getMessage(bundle: BundleName, messageKey: string, tokens?: Tokens): string {
		return this.getBundle(bundle).getMessage(messageKey, tokens);
	}

	public getMessages(bundle: BundleName, messageKey: string, tokens?: Tokens): string[] {
		return this.getBundle(bundle).getMessages(messageKey, tokens);
	}

	private getBundle(bundle: BundleName): Messages<string> {
		if (!this.bundleMap.has(bundle)) {
			this.bundleMap.set(bundle, Messages.loadMessages('@salesforce/plugin-code-analyzer', bundle.toString()));
		}
		// @ts-expect-error Map.get() can technically return undefined, but that will never happen in practice.
		return this.bundleMap.get(bundle);
	}
}

let INSTANCE: MessageCatalog;

export function getMessage(bundle: BundleName, messageKey: string, tokens?: Tokens): string {
	INSTANCE = INSTANCE || new MessageCatalog();
	return INSTANCE.getMessage(bundle, messageKey, tokens);
}

export function getMessages(bundle: BundleName, messageKey: string, tokens?: Tokens): string[] {
	INSTANCE = INSTANCE || /* istanbul ignore next */ new MessageCatalog();
	return INSTANCE.getMessages(bundle, messageKey, tokens);
}
