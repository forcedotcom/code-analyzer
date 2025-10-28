export class ConsoleOuputInterceptor {
	private origStdOutWrite: typeof process.stdout.write;
	private origStdErrWrite: typeof process.stderr.write;
	private origConsoleLog: typeof console.log;
	private origConsoleError: typeof console.error;
	public stdOut: string = '';
	public stdErr: string = '';
	public out: string = '';

	constructor() {
		this.origStdOutWrite = process.stdout.write;
		this.origStdErrWrite = process.stderr.write;
		this.origConsoleLog = console.log;
		this.origConsoleError = console.error;
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
		console.log = (...args) => {
			const output = args.join(' ') + '\n';
			this.stdOut += output;
			this.out += output;
		};
		console.error = (...args) => {
			const output = args.join(' ') + '\n';
			this.stdErr += output;
			this.out += output;
		}
	}

	stop() {
		process.stdout.write = this.origStdOutWrite;
		process.stderr.write = this.origStdErrWrite;
		console.log = this.origConsoleLog;
		console.error = this.origConsoleError;
	}
}