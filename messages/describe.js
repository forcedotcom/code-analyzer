module.exports = {
	"commandDescription": "Provide detailed information about a rule.",
	"commandDescriptionLong": `Use this command to better understand a particular rule.
	For each rule, you can find information about the language it works on, 
	the violation it detects as well as an example code of how the violation looks.
	The description also includes the categories and rulesets that the rule belongs to.
	Please make sure your machine has Java 8 or greater setup correctly.`,
	"flags": {
		"rulenameDescription": "The name of a rule.",
		"rulenameDescriptionLong": "Name of the rule to describe in more detail."
	},
	"output": {
		"noMatchingRules": "No rules exist with the name '{0}'",
		"multipleMatchingRules": "Found {0} rules with the name '{1}'"
	},
	"examples": {
		// The example for when only one rule matches the provided name.
		"normalExample": `$ sfdx scanner:rule:describe --rulename ExampleRule
	name:        ExampleRule
	categories:  ExampleCategory
	rulesets:    Ruleset1
							 Ruleset2
							 Ruleset3
	languages:   apex
	description: Short description of rule
	message:     ExampleRule Violated.
	`
	}
};
