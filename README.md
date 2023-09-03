# Salesforce Code Analyzer

[![Version](https://img.shields.io/npm/v/@salesforce/sfdx-scanner.svg)](https://npmjs.org/package/@salesforce/sfdx-scanner)
[![Downloads/week](https://img.shields.io/npm/dw/@salesforce/sfdx-scanner.svg)](https://npmjs.org/package/@salesforce/sfdx-scanner)
[![Downloads/total](https://img.shields.io/npm/dt/@salesforce/sfdx-scanner.svg)](https://npmjs.org/package/@salesforce/sfdx-scanner)
[![GitHub stars](https://img.shields.io/github/stars/forcedotcom/sfdx-scanner)](https://gitHub.com/forcedotcom/sfdx-scanner/stargazers/)
[![GitHub contributors](https://img.shields.io/github/contributors/forcedotcom/sfdx-scanner.svg)](https://github.com/forcedotcom/sfdx-scanner/graphs/contributors/)
[![License](https://img.shields.io/npm/l/@salesforce/sfdx-scanner.svg)](https://github.com/forcedotcom/sfdx-scanner/blob/main/LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Salesforce Code Analyzer is a unified tool for static analysis of source code.
Code Analyzer analyzes multiple languages.
It relies on a consistent command-line interface and produces a results file of rule violations.
Use the results to review and improve your code.

If you're listing a managed package on AppExchange, it must pass security review.
You're also required to upload your Salesforce Code Analyzer scan reports.
Attach your Code Analyzer reports to your submission in the AppExchange Security Review Wizard.
For more info, read [Scan Your Code with Salesforce Code Analyzer](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/security_review_code_analyzer_scan.htm) and [AppExchange Security Review](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/security_review_overview.htm).

Code Analyzer current supports the PMD rule engine, PMD Copy Paste Detector, ESLint, RetireJS, and Salesforce Graph Engine.

Integrate Code Analyzer into your Continuous Integration/Continuous Development (CI/CD) process to enforce rules that you define and to produce high-quality code.

# Salesforce Code Analyzer Documentation
Read [Salesforce Code Analyzer](https://forcedotcom.github.io/sfdx-scanner/) documentation to learn:
* how to install Code Analyzer
* what is included in the Code Analyzer command reference
* the structure of Code Analyzer architecture
* how to write and manage custom rules

### Contribute to Salesforce Code Analyzer
Read these instructions to [contribute to Code Analyzer](https://github.com/forcedotcom/sfdx-scanner/blob/dev/CONTRIBUTING.md)
