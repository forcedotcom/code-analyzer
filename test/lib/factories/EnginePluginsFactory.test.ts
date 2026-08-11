import {EnginePluginsFactoryImpl} from '../../../src/lib/factories/EnginePluginsFactory.js';


describe('EnginePluginsFactoryImpl', () => {
	it('Loads expected engines', () => {
		const pluginsFactory = new EnginePluginsFactoryImpl();
		const enginePlugins = pluginsFactory.create();

		expect(enginePlugins).toHaveLength(4);
		expect(enginePlugins[0].getAvailableEngineNames()).toEqual(['eslint']);
		expect(enginePlugins[1].getAvailableEngineNames()).toEqual(['pmd', 'cpd']);
		expect(enginePlugins[2].getAvailableEngineNames()).toEqual(['retire-js']);
		expect(enginePlugins[3].getAvailableEngineNames()).toEqual(['regex']);
	});
});
