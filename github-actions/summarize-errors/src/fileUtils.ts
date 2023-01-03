import {constants as fsConstants, promises as fs} from "fs";


async function fileExists(fileName: string): Promise<boolean> {
	try {
		await fs.access(fileName, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export async function readFile(fileName: string): Promise<string> {
	if (!await fileExists(fileName)) {
		throw new Error(`Cannot summarize results. File ${fileName} does not exist.`);
	}
	return fs.readFile(fileName, 'utf-8');
}
