import {OutputFormat} from '../../../src/lib/models/ConfigModel.js';
import {ConfigFileWriter} from '../../../src/lib/writers/ConfigWriter.js';
import {StubConfigModel} from '../../stubs/StubConfigModel.js';
import {DisplayEvent, DisplayEventType, SpyDisplay} from '../../stubs/SpyDisplay.js';
import { StubFileSystem } from '../../stubs/StubFileSystem.js';

describe('ConfigWriter implementations', () => {
	let fileSystem: StubFileSystem;
	beforeEach(() => {
		fileSystem = new StubFileSystem();
	});

	describe('ConfigWriterImpl', () => {
		it.each([
			{ext: '.yaml', expectedOutput: `# This is a leading comment\nResults formatted as ${OutputFormat.RAW_YAML}`},
			{ext: '.yml', expectedOutput: `# This is a leading comment\nResults formatted as ${OutputFormat.RAW_YAML}`}
		])('Accepts and outputs valid file format: *$ext', async ({ext, expectedOutput}) => {
			const validFile = `beep${ext}`;
			const spyDisplay: SpyDisplay = new SpyDisplay(true);
			const configFileWriter = ConfigFileWriter.fromFile(validFile, spyDisplay, fileSystem);

			const stubbedConfig = new StubConfigModel();

			const result: boolean = await configFileWriter.write(stubbedConfig);

			expect(result).toEqual(true);
			expect(spyDisplay.getDisplayEvents()).toHaveLength(0);

			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(1);
			expect(fileSystem.writeFileSyncCallHistory).toEqual([{
				file: validFile,
				contents: expectedOutput
			}]);
		});

		it.each([
			{case: 'Confirmation granted', confirmation: true, expectedCallCount: 1},
			{case: 'Confirmation denied', confirmation: false, expectedCallCount: 0}
		])('Only overwrites existing file after requesting user confirmation. Case: $case', async ({confirmation, expectedCallCount}) => {
			fileSystem.existsReturnValue = true;
			const spyDisplay: SpyDisplay = new SpyDisplay(confirmation);
			const configFileWriter = ConfigFileWriter.fromFile(`code-analyzer.yml`, spyDisplay, fileSystem);

			const stubbedConfig = new StubConfigModel();

			const result: boolean = await configFileWriter.write(stubbedConfig);

			const displayEvents: DisplayEvent[] = spyDisplay.getDisplayEvents();
			expect(displayEvents).toHaveLength(1);
			expect(result).toEqual(confirmation);
			// The user should be prompted to confirm override.
			expect(displayEvents[0].type).toEqual(DisplayEventType.CONFIRM);
			expect(displayEvents[0].data).toContain('overwrite');
			expect(fileSystem.writeFileSyncCallHistory).toHaveLength(expectedCallCount);
		});

		it('Rejects invalid file format: *.txt', async () => {
			const invalidFile = 'beep.txt';
			const spyDisplay: SpyDisplay = new SpyDisplay(true);
			expect(() => ConfigFileWriter.fromFile(invalidFile, spyDisplay)).toThrow(invalidFile);
		})
	});
});
