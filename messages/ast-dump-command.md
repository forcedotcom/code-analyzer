# command.summary

Dump the Abstract Syntax Tree (AST) for a given source file.

# command.description

Generate and display the AST that PMD produces when parsing a source file. This is useful for understanding how PMD interprets your code and for developing custom PMD rules. The command supports Apex, Visualforce, HTML, XML, and JavaScript files.

# command.examples

- Dump the AST for an Apex class file in JSON format (default):

    <%= config.bin %> <%= command.id %> --file ./force-app/main/default/classes/MyClass.cls

- Dump the AST in XML format:

    <%= config.bin %> <%= command.id %> --file ./force-app/main/default/classes/MyClass.cls --format xml

- Dump the AST and write the output to a file:

    <%= config.bin %> <%= command.id %> --file ./force-app/main/default/classes/MyClass.cls --output-file ast-output.json

- Explicitly specify the language when the file extension is ambiguous:

    <%= config.bin %> <%= command.id %> --file ./src/myfile.html --language html

- Use a custom configuration file to specify Java command path:

    <%= config.bin %> <%= command.id %> --file ./force-app/main/default/classes/MyClass.cls --config-file ./code-analyzer.yml

# flags.file.summary

Path to the source file to parse.

# flags.file.description

The file whose AST you want to generate. The file must exist and be a regular file (not a directory). If you don't specify the `--language` flag, the language is auto-detected from the file extension.

# flags.language.summary

Language of the source file.

# flags.language.description

Explicitly specify the language of the source file. Defaults to `apex`. Supported languages are: apex, visualforce, html, xml, and javascript.

# flags.format.summary

Output format for the AST.

# flags.format.description

Choose between `xml` (default) or `json`. The XML format outputs the raw PMD AST XML, preserving the full tree structure. The JSON format provides a flat array of nodes with names, attributes, parent, and ancestor information.

# flags.output-file.summary

Path to the file where the AST output is written.

# flags.output-file.description

If specified, the AST output is written to this file instead of being displayed in the terminal. The content format depends on the `--format` flag.

# flags.config-file.summary

Path to the configuration file used to customize engine settings.

# flags.config-file.description

Use a Code Analyzer configuration file to specify engine overrides such as a custom `java_command` path. If not specified, the default configuration is used.

# error.fileNotFound

File not found: %s

# error.notRegularFile

Path is not a regular file: %s

# error.unsupportedLanguage

Unable to determine language for file: %s. Use the --language flag to specify one of: apex, visualforce, html, xml, javascript.

# error.parseFailed

Failed to parse AST: %s
