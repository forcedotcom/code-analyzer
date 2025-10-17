import * as fs from 'node:fs/promises';
import path from 'node:path';
import {makeGrey, toStyledHeaderAndBody, toStyledHeader, toStyledPropertyList, indent, __ANSIS} from '../../../src/lib/utils/StylingUtil';
import { Ansis } from 'ansis';

const PATH_TO_COMPARISON_FILES = path.resolve(__dirname, '..', '..', 'fixtures', 'comparison-files', 'lib',
	'utils', 'StylingUtil.test.ts');

// Note that vitest by default turns off all coloring (probably with FORCE_COLOR='1' env variable), so we need
// to tell our ansis instance that we want to ignore the environment variables and just force all colors
__ANSIS.instance = new Ansis(3); // Forces all colors

describe('StylingUtil tests', () => {
	describe('#toStyledHeaderAndBody()', () => {
		it('Properly styles header and body', async () => {
			const header = 'SAMPLE HEADER TEXT';
			const body = {
				beep: 'abcde',
				boop: 'true',
				a: '3',
				z: '7'
			};

			const actualOutput = toStyledHeaderAndBody(header, body, ['boop', 'beep', 'a']);

			const expectedOutput = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'styled-header-and-body.txt'), {encoding: 'utf-8'}));

			expect(actualOutput).toEqual(expectedOutput);
		});
	});

	describe('#makeGrey()', () => {
		it('Properly styles input', async () => {
			const input = 'this text is styled as a comment';
			const styledComment = makeGrey(input);

			const expectedOutput = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'styled-comment.txt'), {encoding: 'utf-8'}));
			expect(styledComment).toEqual(expectedOutput);

		});
	});

	describe('#toStyledHeader()', () => {
		it('Properly styles input', async () => {
			const input: string = 'SAMPLE HEADER TEXT';
			const styledHeader = toStyledHeader(input);

			const expectedHeader = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'styled-header.txt'), {encoding: 'utf-8'}));

			expect(styledHeader).toEqual(expectedHeader);
		});
	});

	describe('#toStyledPropertyList()', () => {
		it('When no keys are selected, all keys are returned in declaration order', async () => {
			const input = {
				beep: 'abcde',
				boop: 'true',
				a: '3',
				z: '7'
			};
			const actualOutput = toStyledPropertyList(input);

			const expectedOutput = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'all-keys-printed.txt'), {encoding: 'utf-8'}));

			expect(actualOutput).toEqual(expectedOutput);
		});

		it('When some keys are selected, those keys are returned in selected order', async () => {
			const input = {
				beep: 'abcde',
				boop: 'true',
				lorem: 'ipsum',
				a: '3',
				z: '7'
			};
			const actualOutput = toStyledPropertyList(input, ['boop', 'a', 'beep']);

			const expectedOutput = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'subset-of-keys-printed.txt'), {encoding: 'utf-8'}));

			expect(actualOutput).toEqual(expectedOutput);
		});

		it('When a non-existent key is selected, an empty string is used instead', async () => {
			const input = {
				beep: 'abcde',
				boop: 'true',
				lorem: 'ipsum',
				a: '3',
				z: '7'
			};
			const actualOutput = toStyledPropertyList(input, ['notARealKey', 'beep']);

			const expectedOutput = (await fs.readFile(path.join(PATH_TO_COMPARISON_FILES, 'non-existent-key-printed.txt'), {encoding: 'utf-8'}));

			expect(actualOutput).toEqual(expectedOutput);
		})

		it('When key selection is empty list, an empty string is returned', () => {
			const input = {
				beep: 'abcde',
				boop: 'true',
				lorem: 'ipsum',
				a: '3',
				z: '7'
			};
			const actualOutput = toStyledPropertyList(input, []);

			expect(actualOutput).toEqual('');
		});

		it('When provided object is null, an empty string is returned', () => {
			const actualOutput = toStyledPropertyList(null);

			expect(actualOutput).toEqual('');
		});
	});

	describe('#indent()', () => {
		it('Applies indentation to non-empty lines only', () => {
			expect(indent('line1\n\nline3\n    line4\n    ')).toEqual('    line1\n\n    line3\n        line4\n        ');
		});
	});
});
