import {Ansis} from 'ansis';

/**
 * For now, the styling methods only accept objects if all of their keys correspond to string values. This puts the
 * burden of formatting non-string properties on the caller.
 */
type Styleable = null | undefined | {[key: string]: string|string[]};

export const __ANSIS = {
	// The default Ansis instance uses environment variables to decide whether to add decoration or not.
	// We use this holder so that in testing we can swap out this instance with new Ansis(3) to force color in order
	// to make the tests more robust.
	instance: new Ansis() // This auto detects whether to use color or not
}

export function toStyledHeaderAndBody(header: string, body: Styleable, keys?: string[]): string {
	const styledHeader: string = toStyledHeader(header);
	const styledBody: string = indent(toStyledPropertyList(body, keys));
	return `${styledHeader}\n${styledBody}`;
}

export function toStyledHeader(header: string): string {
	return `${__ANSIS.instance.dim('===')} ${__ANSIS.instance.bold(header)}`;
}

export function makeGrey(str: string): string {
	return __ANSIS.instance.dim(str);
}

export function toStyledPropertyList(body: Styleable, selectedKeys?: string[]): string {
	if (body == null || (selectedKeys && selectedKeys.length === 0)) {
		return '';
	}
	const keysToPrint = selectedKeys || [...Object.keys(body)];
	const longestKeyLength = Math.max(...keysToPrint.map(k => k.length));

	const styleProperty = (key: string, value: string|string[]): string => {
		const keyPortion = `${__ANSIS.instance.blue(key)}:`;
		const keyValueGap = ' '.repeat(longestKeyLength - key.length + 1);
		if (typeof value === 'string') {
			const valuePortion = value.replace('\n', `\n${' '.repeat(longestKeyLength + 2)}`);
			return `${keyPortion}${keyValueGap}${valuePortion}`;
		} else {
			const valuePortion: string = value.map(v => `${indent(v, 4)}`).join('\n');
			return `${keyPortion}\n${valuePortion}`;
		}
	}

	const output = keysToPrint.map(key => styleProperty(key, body[key] || ''));
	return output.join('\n');
}

export function indent(text: string, indentLength: number = 4): string {
	return text.replace(/^.+/gm, m => m.length > 0 ? ' '.repeat(indentLength) + m : m);
}