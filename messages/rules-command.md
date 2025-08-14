# command.summary

List the rules that are available to analyze your code.

# command.description

You can also view details about the rules, such as the engine it's associated with, tags, and description.

Use this command to determine the exact set of rules to analyze your code. The `code-analyzer run` command has similar flags as this command, so once you've determined the flag values for this command that list the rules you want to run, you specify the same values to the `code-analyzer run` command.

We're continually improving Salesforce Code Analyzer. Tell us what you think! Give feedback at https://sfdc.co/CodeAnalyzerFeedback.

# command.examples

- List rules using the default behavior: include rules from all engines that have a "Recommended" tag; display the rules using concise table format; and automatically apply rule or engine overrides if a `code-analyzer.yml` or `code-analyzer.yaml` file exists in the current folder:

    <%= config.bin %> <%= command.id %> 

- The previous example is equivalent to this example:

    <%= config.bin %> <%= command.id %> --rule-selector Recommended --view table --config-file ./code-analyzer.yml

- List the recommended rules for the "eslint" engine:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:Recommended

- List all the rules for the "eslint" engine:

    <%= config.bin %> <%= command.id %> --rule-selector eslint

- The previous example is equivalent to this example:

  <%= config.bin %> <%= command.id %> --rule-selector eslint:all

- List the details about all rules for all engines; also write the rules in JSON format to a file called "rules.json" in the "out" folder, which must already exist:

    <%= config.bin %> <%= command.id %> --rule-selector all --output-file ./out/rules.json --view detail

- Get a more accurate list of the rules that apply specifically to your workspace (all the files in the current folder): 

    <%= config.bin %> <%= command.id %> --rule-selector all --workspace .

- List the recommended rules associated with a workspace that targets all the files in the folder "./other-source" and only the Apex class files (extension .cls) under the folder "./force-app":

    <%= config.bin %> <%= command.id %> --rule-selector Recommended --workspace . --target ./other-source --target ./force-app/**/*.cls

- List all the "eslint" engine rules that have a moderate severity (3) and the recommended "retire-js" engine rules with any severity:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:3 --rule-selector retire-js:Recommended

- Similar to the previous example, but apply the rule overrides and engine settings from the configuration file called `code-analyzer2.yml` in the current folder. If, for example, you changed the severity of an "eslint" rule from moderate (3) to high (2) in the configuration file, then that rule isn't listed:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:3 --rule-selector retire-js:Recommended --config-file ./code-analyzer2.yml

- List the details of the "getter-return" rule of the "eslint" engine and the rules named "no-inner-declarations" in any engine:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:getter-return --rule-selector no-inner-declarations --view detail

- List the details of the recommended "eslint" engine rules that have the tag "problem" and high severity level (2) that apply when targeting the files within the folder "./force-app":

    <%= config.bin %> <%= command.id %> --rule-selector eslint:Recommended:problem:2 --view detail --target ./force-app

# flags.workspace.summary

Set of files that make up your workspace.

# flags.workspace.description

Use the `--workspace` flag to return a more accurate list of the rules that apply to the files that make up your workspace. Typically, a workspace is a single project folder that contains all your files. But it can also consist of one or more folders, one or more files, and use glob patterns (wildcards). If you specify this flag multiple times, then your workspace is the sum of the files and folders. 

The command uses the types of files in the workspace, such as JavaScript or Typescript, to determine which rules to list. For example, if your workspace contains only JavaScript files, the command doesn't list TypeScript rules. The command uses a file's extension to determine what kind of file it is, such as ".ts" for TypeScript.

Some engines may be configured to add additional rules based on what it finds in your workspace. For example, if you set the engines.eslint.auto_discover_eslint_config value of your `code-analyzer.yml` file to true, then supplying your workspace allows the "eslint" engine to examine your files in order to find ESLint configuration files that could potentially add in additional rules.

If you specify `--target` but not `--workspace`, then the current folder '.' is used as your workspace.

# flags.target.summary

Subset of files within your workspace that you want to target for analysis.

# flags.target.description

Use the `--target` flag to return a more accurate list of the rules that apply to only a subset of targeted files within your workspace. You can specify a target as a file, a folder, or a glob pattern. If you specify this flag multiple times, then the full list of targeted files is the sum of the files and folders.

The command uses the type of the targeted files, such as JavaScript or Typescript, to determine which rules to list. For example, if you target only JavaScript files, the command doesn't list TypeScript rules. The command uses a file's extension to determine what kind of file it is, such as ".ts" for TypeScript.

Each targeted file must live within the workspace specified by the –-workspace flag.

If you specify `--workspace` but not `--target`, then all the files within your workspace are targeted.

# flags.rule-selector.summary

Selection of rules, based on engine name, severity level, rule name, tag, or a combination of criteria separated by colons. 

# flags.rule-selector.description

Use the `--rule-selector` flag to select the list of rules based on specific criteria. For example, you can select by engine, such as the rules associated with the "retire-js" or "eslint" engine. Or select by the severity of the rules, such as high or moderate. You can also select rules using tag values or rule names. Every rule has a name, which is unique within the scope of an engine. Most rules have tags, although it's not required. An example of a tag is "Recommended". 

You can combine different criteria using colons to further filter the list; the colon works as an intersection. For example, `--rule-selector eslint:Security` lists rules associated only with the "eslint" engine that have the Security tag. The flag `--rule-selector eslint:Security:3` flag lists the "eslint" rules that have the Security tag and moderate severity (3). To add multiple rule selectors together (a union), specify the `--rule-selector` flag multiple times, such as `--rule-selector eslint:Recommended --rule-selector retire-js:3`.

Run `<%= config.bin %> <%= command.id %> --rule-selector all` to list the possible values for engine name, rule name, tags, and severity levels that you can use with this flag.

# flags.config-file.summary

Path to the configuration file used to customize the engines and rules. 

# flags.config-file.description

Code Analyzer has an internal default configuration for its rule and engine properties. If you want to override these defaults, you can create a Code Analyzer configuration file.

We recommend that you name your Code Analyzer configuration file `code-analyzer.yml` or `code-analyzer.yaml` and put it at the root of your workspace. You then don't need to use this flag when you run the `<%= command.id %>` command from the root of your workspace, because it automatically looks for either file in the current folder, and if found, applies its rule overrides and engine settings. If you want to name the file something else, or put it in an alternative folder, then you must specify this flag.

To help you get started, use the `code-analyzer config` command to create your first Code Analyzer configuration file. With it, you can change the severity of an existing rule, change a rule's tags, and so on. Then use this flag to specify the file so that the command takes your customizations into account.

# flags.view.summary

Format to display the rules in the terminal. 

# flags.view.description

The format `table` is concise and shows minimal output, the format `detail` shows all available information. 

If you specify neither `--view` nor `--output-file`, then the default table view is shown. If you specify `--output-file` but not `--view`, only summary information is shown in the terminal.

# flags.output-file.summary

Name of the file where the selected rules are written. The file format depends on the extension you specify; the currently supported extensions are .json and .csv

# flags.output-file.description

If you don't specify this flag, the command outputs the rules to only the terminal. Use this flag to write the rules to a file; the format of the rules depends on the extension you provide. For example, `--output-file rules.csv` creates a comma-separated values file. You can specify one of these extensions:

- .csv
- .json

To output the rules to multiple files, specify this flag multiple times. For example, `--output-file rules.json --output-file rules.csv` creates both a JSON file and a CSV file.

If you specify a file within folder, such as `--output-file ./out/rules.json`, the folder must already exist, or you get an error. If the file already exists, it's overwritten without prompting.
