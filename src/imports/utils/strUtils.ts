import path from 'path';

export function filePathWithoutExtension(filePath: string) {
	return path.basename(filePath, path.extname(filePath));
}

/**
 * Convert a string to a regex pattern that matches various accent forms of the letters
 *
 * This function takes a string and converts it to a regex-compatible pattern where
 * letters like 'a', 'e', 'i', etc. are replaced with character classes that include
 * all their accented variations. This is useful for creating case and accent-insensitive
 * search patterns.
 *
 * @param {string} str - The input string to convert
 * @returns {string} A regex-compatible string with accent variations
 *
 * @example
 * // Returns '[cç][aàáâãäåæ][sšß][aàáâãäåæ]'
 * accentToRegex('casa')
 *
 * @example
 * // Use with RegExp to create an accent-insensitive search pattern
 * const pattern = new RegExp(accentToRegex('educacao'), 'i');
 * pattern.test('educação'); // true
 *
 * @example
 * // Handles special regex characters properly
 * const pattern = new RegExp(accentToRegex('user.name+special?'), 'i');
 * pattern.test('user.name+special?'); // true
 *
 * @example
 * // Use in a larger pattern
 * const pattern = new RegExp(`^${accentToRegex('rua')}\\s.*$`, 'i');
 * pattern.test('Rúa Principal'); // true
 */
export const accentToRegex = (str: string): string => {
	if (str === null || str === undefined) return '';

	const charMap: Record<string, string> = {
		a: '[aàáâãäåæ]',
		c: '[cç]',
		d: '[dð]',
		e: '[eèéêëẽ]',
		i: '[iìíîïĩ]',
		n: '[nñ]',
		o: '[oœðñòóôõöø]',
		u: '[uµùúûü]',
		s: '[sšß]',
		z: '[zž]',
		y: '[yýÿ¥]',
	};

	const regexSpecialChars = /[\[\]\\\/\.\*\+\?\(\)\{\}\^\$]/g;

	return String(str)
		.toLowerCase()
		.replace(regexSpecialChars, '\\$&') // Escape all regex special characters
		.split('')
		.map(char => charMap[char] || char)
		.join('');
};
