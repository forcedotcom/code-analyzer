export class ConsoleOuputInterceptor {
	private origStdOutWrite: typeof process.stdout.write;
	private origStdErrWrite: typeof process.stderr.write;
	public stdOut: string = '';
	public stdErr: string = '';
	public out: string = '';

	constructor() {
		this.origStdOutWrite = process.stdout.write;
		this.origStdErrWrite = process.stderr.write;
	}

	start() {
		process.stdout.write = (chunk: string) => {
			this.stdOut += chunk;
			this.out += chunk;
			return true;
		}
		process.stderr.write = (chunk: string) => {
			this.stdErr += chunk;
			this.out += chunk;
			return true;
		}
	}

	stop() {
		process.stdout.write = this.origStdOutWrite;
		process.stderr.write = this.origStdErrWrite;
	}
}