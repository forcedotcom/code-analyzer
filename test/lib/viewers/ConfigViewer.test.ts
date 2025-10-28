import {ConfigStyledYamlViewer} from '../../../src/lib/viewers/ConfigViewer.js';
import {DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay.js';
import {StubConfigModel} from '../../stubs/StubConfigModel.js';

describe('ConfigViewer implementations', () => {
	let spyDisplay: SpyDisplay;

	beforeEach(() => {
		spyDisplay = new SpyDisplay();
	})

	describe('ConfigStyledYamlViewer', () => {
		let viewer: ConfigStyledYamlViewer;

		beforeEach(() => {
			viewer = new ConfigStyledYamlViewer(spyDisplay);
		})

		it('When given a config, outputs it as styled YAML with a leading newline', () => {
			// ==== TEST SETUP ====
			// Instantiate the config model.
			const configModel = new StubConfigModel();

			// ==== TESTED METHOD ====
			// Display the config
			viewer.view(configModel);

			// ==== ASSERTIONS ====
			const displayEvents = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(1);
			expect(displayEvents[0].type).toEqual(DisplayEventType.LOG);
			expect(displayEvents[0].data).toEqual(`\n# This is a leading comment\nResults formatted as STYLED_YAML`);
		});
	});
});
