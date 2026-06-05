import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import {CodeAnalyzerConfigFactoryImpl} from '../../lib/factories/CodeAnalyzerConfigFactory.js';
import {AstDumpAction, AstDumpDependencies, AstDumpInput, AstDumpOutput} from '../../lib/actions/AstDumpAction.js';
import {BundleName, getMessage, getMessages} from '../../lib/messages.js';

export default class AstDumpCommand extends SfCommand<void> {
	public static readonly enableJsonFlag = true;
	public static readonly summary = getMessage(BundleName.AstDumpCommand, 'command.summary');
	public static readonly description = getMessage(BundleName.AstDumpCommand, 'command.description');
	public static readonly examples = getMessages(BundleName.AstDumpCommand, 'command.examples');

	public static readonly flags = {
		file: Flags.file({
			summary: getMessage(BundleName.AstDumpCommand, 'flags.file.summary'),
			description: getMessage(BundleName.AstDumpCommand, 'flags.file.description'),
			required: true,
			exists: true
		}),
		language: Flags.string({
			summary: getMessage(BundleName.AstDumpCommand, 'flags.language.summary'),
			description: getMessage(BundleName.AstDumpCommand, 'flags.language.description'),
			char: 'l',
			options: ['apex', 'visualforce', 'html', 'xml', 'javascript'],
			default: 'apex'
		}),
		format: Flags.string({
			summary: getMessage(BundleName.AstDumpCommand, 'flags.format.summary'),
			description: getMessage(BundleName.AstDumpCommand, 'flags.format.description'),
			options: ['json', 'xml'],
			default: 'xml'
		}),
		'output-file': Flags.string({
			summary: getMessage(BundleName.AstDumpCommand, 'flags.output-file.summary'),
			description: getMessage(BundleName.AstDumpCommand, 'flags.output-file.description'),
		}),
		'config-file': Flags.file({
			summary: getMessage(BundleName.AstDumpCommand, 'flags.config-file.summary'),
			description: getMessage(BundleName.AstDumpCommand, 'flags.config-file.description'),
			char: 'c',
			exists: true
		})
	};

	public async run(): Promise<void> {
		const parsedFlags = (await this.parse(AstDumpCommand)).flags;

		const dependencies: AstDumpDependencies = {
			configFactory: new CodeAnalyzerConfigFactoryImpl()
		};

		const action = AstDumpAction.createAction(dependencies);

		const input: AstDumpInput = {
			file: parsedFlags.file,
			language: parsedFlags.language,
			format: parsedFlags.format as 'json' | 'xml',
			'output-file': parsedFlags['output-file'],
			'config-file': parsedFlags['config-file']
		};

		const output: AstDumpOutput = await action.execute(input);

		if (output.status === 'error') {
			this.error(output.message);
		}

		// Display output
		if (!input['output-file']) {
			if (input.format === 'xml') {
				this.log((output as { ast: string }).ast);
			} else {
				this.log(JSON.stringify(output, null, 2));
			}
		} else {
			this.log(`AST written to: ${input['output-file']}`);
		}
	}
}
