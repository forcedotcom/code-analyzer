import * as fg from 'fast-glob';
import {CodeAnalyzer, Workspace} from '@salesforce/code-analyzer-core';
import {getMessage, BundleName} from '../messages.js';

export async function createWorkspace(core: CodeAnalyzer, workspacePaths: string[], targetPaths?: string[]): Promise<Workspace> {
	const processedWorkspacePaths: string[] = await processPaths(workspacePaths, 'Workspace');
	const processedTargetPaths: string[]|undefined = targetPaths ? await processPaths(targetPaths, 'Target') : undefined;
	// Part of the contract for Core's `createWorkspace()` method is that paths are localized to the current OS, hence
	// it's not a problem for Glob results to be UNIX-formatted since they'll be converted right back.
	return core.createWorkspace(processedWorkspacePaths, processedTargetPaths);
}

async function processPaths(rawPaths: string[], pathType: string): Promise<string[]> {
	const processedPaths: string[] = [];
	for (const rawPath of rawPaths) {
		// Negative globs are not currently supported.
		if (rawPath.includes("!")) {
			throw new Error(getMessage(BundleName.WorkspaceUtil, 'error.negative-globs-unsupported', [pathType, rawPath]));
			// If the path has a star (*) or question mark in it, we assume it's a glob.
		} else if (/[*?]/.test(rawPath)) {
			// For the convenience of Windows users, we'll normalize glob paths into UNIX style, so they're valid globs.
			const normalizedPath = rawPath.replace(/[\\/]/g, '/');
			// NOTE: We're pushing the strict results of the Glob, meaning that the paths will be normalized to UNIX style.
			processedPaths.push(...await fg.glob(normalizedPath));
		} else {
			processedPaths.push(rawPath);
		}
	}
	return processedPaths;
}
