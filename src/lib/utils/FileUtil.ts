import * as fs from 'node:fs';

export interface FileSystem {
	exists(file: string): Promise<boolean>

	writeFileSync(file: string, contents: string): void

	createWriteStream(file: string): Promise<WriteStream>;
}

export interface WriteStream {
	write(content: string): void
	end(): void
}

export class RealFileSystem implements FileSystem {
	async exists(file: string): Promise<boolean> {
		try {
			await fs.promises.access(file, fs.constants.F_OK);
			return true;
		} catch (_e) {
			return false;
		}
	}

	writeFileSync(file: string, contents: string): void {
		fs.writeFileSync(file, contents);
	}

	createWriteStream(file: string): Promise<WriteStream> {
		// We return a promise so that we can await for the stream to be opened
		// if we want before proceeding with writes.
		return new Promise((resolve, reject) => {
			const stream: fs.WriteStream = fs.createWriteStream(file);
			stream.once('open', () => resolve(stream));
			stream.once('error', (err) => reject(err));
		});
	}
}