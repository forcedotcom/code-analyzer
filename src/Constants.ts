import os = require('os');
import path = require('path');

export const SFDX_SCANNER_PATH = path.join(os.homedir(), '.sfdx-scanner');
export const CATALOG_FILE = 'Catalog.json';
export const CUSTOM_PATHS_FILE = 'CustomPaths.json';
export const CONFIG_FILE = 'Config.json';
