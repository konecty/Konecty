import deburr from 'lodash/deburr';

const ILLEGAL = /[/?<>\\:*|"]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x80-\x9f]/g;
const RESERVED = /^\.+$/;
const WINDOWS_RESERVE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const WINDOWS_TRAILING = /[. ]+$/;

export function sanitizeFilename(filename: string): string {
	return deburr(filename).replace(ILLEGAL, '').replace(CONTROL, '').replace(RESERVED, '').replace(WINDOWS_RESERVE, '').replace(WINDOWS_TRAILING, '').replace(/ /g, '_');
}
