import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { CustomClasspathRegistrar } from '../../../lib/customclasspath/CustomClasspathRegistrar';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('scanner', 'add');


export default class Add extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx scanner:rule:add --language "apex" --path "/dir/to/jar/lib"
        (todo: add sample output here)

        $ sfdx scanner:rule:add --language "apex" --path "/file/path/to/customrule.jar,/dir/to/jar/lib"
        (todo: add sample output here)
        `
  ];

  protected static flagsConfig = {
    language: flags.string({
        char: 'l',
        description: messages.getMessage('flags.languageFlagDescription'),
        required: true
    }),
    paths: flags.array({
        char: 'p',
        description: messages.getMessage('flags.pathsFlagDescription'),
        required: true
    })
  };

  public async run(): Promise<AnyJson> {

    this.validateFlags();

    const language = this.flags.language;
    const paths = this.flags.paths;

    this.logger.trace(`Language: ${language}`);
    this.logger.trace(`Rule path: ${paths}`);

    // Add to Custom Classpath registry
    const creator = new CustomClasspathRegistrar();
    await creator.createEntries(language, paths);

    return { success: true, language: language, paths: paths };
  }

  private validateFlags() {
    if (this.flags.language.length === 0) {
      throw SfdxError.create('scanner', 'add', 'validations.errorLanguageCannotBeEmpty', []);
    }
    if (this.flags.paths.length === 0) {
      throw SfdxError.create('scanner', 'add', 'validations.errorPathCannotBeEmpty', []);
    }
  }

}
