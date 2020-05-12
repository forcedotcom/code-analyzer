import fs = require('fs');
import {Stats} from 'fs';

/**
 * Handles all File and IO operations.
 * Mock this class to override file change behavior from unit tests.
 */
export class FileHandler {
	exists(filename: string): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			fs.access(filename, fs.constants.F_OK, (err) => {
				resolve(!err);
			});
		});
	}

	stats(filename: string): Promise<Stats> {
		return new Promise<Stats>((resolve, reject) => {
			return fs.stat(filename, ((err, stats) => {
				if(!err) {
					resolve(stats);
				} else {
					reject(err);
				}
			}));
		});
	}

	async isDir(filename: string): Promise<boolean> {
		return await this.exists(filename) && (await this.stats(filename)).isDirectory();
	}

	readDir(filename: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			return fs.readdir(filename, ((err, files) => {
				if(!err) {
					resolve(files);
				} else {
					reject(err);
				}
			}));
		});
	}

	readFile(filename: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			return fs.readFile(filename, 'utf-8', ((err, data) => {
				if(!err) {
					resolve(data);
				} else {
					reject(err);
				}
			}));
		});
	}

	mkdirIfNotExists(dir: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			return fs.mkdir(dir, {recursive: true}, (err) => {
				if(!err) {
					resolve();
				} else {
					reject(err);
				}
			});
		});
	}

	writeFile(filename: string, fileContent: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			return fs.writeFile(filename, fileContent, (err) => {
				if(!err) {
					resolve();
				} else {
					reject(err);
				}
			});
		});
	}
}
