import {Display} from '../Display.js';
import {ConfigModel, OutputFormat} from '../models/ConfigModel.js';


export interface ConfigViewer {
	view(configModel: ConfigModel): void;
}

export class ConfigStyledYamlViewer implements ConfigViewer {
	private readonly display: Display;

	public constructor(display: Display) {
		this.display = display;
	}

	public view(configModel: ConfigModel): void {
		const styledYaml = configModel.toFormattedOutput(OutputFormat.STYLED_YAML);
		// Prepend a newline to visually separate the output from anything else we've already logged.
		this.display.displayLog('\n' + styledYaml);
	}
}
