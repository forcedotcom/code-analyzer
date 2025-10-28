# command.summary

Analyze your code with a selection of rules to ensure good coding practices.

# command.description

You can scan your codebase with the recommended rules. Or use flags to filter the rules based on engines (such as "retire-js" or "eslint"), rule names, tags, and more. 

If you want to preview the list of rules before you actually run them, use the `code-analyzer rules` command, which also has the `--config-file`, `--rule-selector`, `--target`, and `--workspace` flags that together define the list of rules to be run.

We're continually improving Salesforce Code Analyzer. Tell us what you think! Give feedback at https://sfdc.co/CodeAnalyzerFeedback.

# command.examples

- Analyze code using the default behavior: analyze all the files in the current folder (default workspace) using the Recommended rules; display the output in the terminal with the concise table view; and automatically apply rule or engine overrides if a `code-analyzer.yml` or `code-analyzer.yaml` file exists in the current folder:

    <%= config.bin %> <%= command.id %>

- The previous example is equivalent to this example:

    <%= config.bin %> <%= command.id %> --rule-selector Recommended --workspace . --target . --view table --config-file ./code-analyzer.yml

- Analyze the files using the recommended "eslint" rules and show details of the violations:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:Recommended --view detail

- Analyze the files using all the "eslint" rules:

    <%= config.bin %> <%= command.id %> --rule-selector eslint

- The previous example is equivalent to this example:

  <%= config.bin %> <%= command.id %> --rule-selector eslint:all

- Analyze the files using all rules for all engines:

    <%= config.bin %> <%= command.id %> --rule-selector all

- Analyze the files using only rules in the "pmd" engine with a severity of high (2) or moderate (3), and the "Performance" tag.

    <%= config.bin %> <%= command.id %> --rule-selector "pmd:(2,3):Performance"

- Analyze files using the recommended "retire-js" rules; target all the files in the folder "./other-source" and only the Apex class files (extension .cls) in the folder "./force-app":

    <%= config.bin %> <%= command.id %> --rule-selector retire-js:Recommended --target ./other-source --target ./force-app/**/*.cls

- Specify a custom configuration file and output the results to the "results.csv" file in CSV format; the commands fails if it finds a violation that exceeds the moderate severity level (3):

    <%= config.bin %> <%= command.id %> --config-file ./code-analyzer2.yml --output-file results.csv --severity-threshold 3

- Analyze the files using all the "eslint" engine rules that have a moderate severity (3) and the recommended "retire-js" engine rules with any severity:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:3 --rule-selector retire-js:Recommended

- Analyze the files using only the "getter-return" rule of the "eslint" engine and any rule named "no-inner-declarations" from any engine:

    <%= config.bin %> <%= command.id %> --rule-selector eslint:getter-return --rule-selector no-inner-declarations

# flags.workspace.summary

Set of files that make up your workspace.

# flags.workspace.description

Typically, a workspace is a single project folder that contains all your files. But it can also consist of one or more folders, one or more files, and use glob patterns (wildcards). If you specify this flag multiple times, then your workspace is the sum of the files and folders.

Some engines often need your entire code base to perform an analysis, even if you want to target only a subset of the files within your workspace , such as with the `--target` flag. For example, the Salesforce Graph Engine might need to compile your entire project in order to properly build a graph so it can perform a data flow analysis on the paths that start in your targeted files.

If you don't specify the `--workspace` flag, then the current folder '.' is used as your workspace.

# flags.target.summary

Subset of files within your workspace to be targeted for analysis.

# flags.target.description

You can specify a target as a file, a folder, or a glob pattern.

If you specify this flag multiple times, then the full list of targeted files is the sum of the files and folders.

Each targeted file must live within the workspace that you specified with the `–-workspace` flag.

If you don't specify the `--target` flag, then all the files within your workspace (specified by the `--workspace` flag) are targeted for analysis.

# flags.rule-selector.summary

Selection of rules, based on engine name, severity level, rule name, tag, or a combination of criteria separated by colons.

# flags.rule-selector.description

Use the `--rule-selector` flag to select the list of rules to run based on specific criteria. For example, you can select by engine, such as the rules associated with the "retire-js" or "eslint" engine. Or select by the severity of the rules, such as high or moderate. You can also select rules using tag values or rule names. Every rule has a name, which is unique within the scope of an engine. Most rules have tags, although it's not required. An example of a tag is "Recommended".

You can further filter the list by combining different criteria using colons to represent logical AND, commas to represent logical OR, and parentheses to create groupings. For example, `--rule-selector "pmd:(Performance,Security):2"` runs rules associated only with the "pmd" engine that have the Security or Performance tags and a high severity (2). You may also specify the flag multiple times to OR multiple selectors together. For example, `--rule-selector Performance,Security` is equivalent to `--rule-selector Performance --rule-selector Security`. Note that if you use parentheses in your selector, the selector should be wrapped in double-quotes.

Run `<%= config.bin %> code-analyzer rules --rule-selector all` to see the possible values for engine name, rule name, tags, and severity levels that you can use with this flag.

# flags.severity-threshold.summary

Severity level of a found violation that must be met or exceeded to cause this command to fail with a non-zero exit code.

# flags.severity-threshold.description

You can specify either a number (2) or its equivalent string ("High"). 

# flags.config-file.summary

Path to the configuration file used to customize the engines and rules.

# flags.config-file.description

Code Analyzer has an internal default configuration for its rule and engine properties. If you want to override these defaults, you can create a Code Analyzer configuration file.

We recommend that you name your Code Analyzer configuration file `code-analyzer.yml` or `code-analyzer.yaml` and put it at the root of your workspace. You then don't need to use this flag when you run the `<%= command.id %>` command from the root of your workspace, because it automatically looks for either file in the current folder, and if found, applies its rule overrides and engine settings. If you want to name the file something else, or put it in an alternative folder, then you must specify this flag.

To help you get started, use the `code-analyzer config` command to create your first Code Analyzer configuration file. With it, you can change the severity of an existing rule, change a rule's tags, and so on. Then use this flag to specify the file so that the command takes your customizations into account.

# flags.view.summary

Format to display the command results in the terminal. 

# flags.view.description

The format `table` is concise and shows minimal output, the format `detail` shows all available information.

If you specify neither `--view` nor `--output-file`, then the default table view is shown. If you specify `--output-file` but not `--view`, only summary information is shown.

# flags.output-file.summary

Name of the file where the analysis results are written. The file format depends on the extension you specify, such as .csv, .html, .xml, and so on. 

# flags.output-file.description

If you don't specify this flag, the command outputs the results to only the terminal. Use this flag to print the results to a file; the format of the results depends on the extension you provide. For example, `--output-file results.csv` creates a comma-separated values file. You can specify one of these extensions:

- .csv
- .html or .htm
- .json
- .sarif or .sarif.json
- .xml

To output the results to multiple files, specify this flag multiple times. For example: `--output-file results.json --output-file report.html` creates both a JSON results file and an HTML file.

If you specify a file within a folder, such as `--output-file ./out/results.json`, the folder must already exist, or you get an error. If the file already exists, it's overwritten without prompting.

# error.invalid-severity-threshold

Expected --severity-threshold=%s to be one of: %s

