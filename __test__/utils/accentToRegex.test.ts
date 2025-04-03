import { accentToRegex } from '../../src/imports/utils/strUtils';

describe('accentToRegex', () => {
	// Basic functionality tests
	test('converts a simple string to regex pattern with accents', () => {
		const result = accentToRegex('casa');
		expect(result).toBe('[cç][aàáâãäåæ][sšß][aàáâãäåæ]');
	});

	test('converts to lowercase before processing', () => {
		const result = accentToRegex('CASA');
		expect(result).toBe('[cç][aàáâãäåæ][sšß][aàáâãäåæ]');
	});

	// Edge cases
	test('handles empty string', () => {
		const result = accentToRegex('');
		expect(result).toBe('');
	});

	test('handles null and undefined', () => {
		// @ts-ignore - Testing null/undefined handling
		expect(accentToRegex(null)).toBe('');
		// @ts-ignore - Testing null/undefined handling
		expect(accentToRegex(undefined)).toBe('');
	});

	test('escapes square brackets in input', () => {
		const result = accentToRegex('a[b]c');
		expect(result).toContain('\\[');
		expect(result).toContain('\\]');
	});

	test('escapes backslashes properly', () => {
		const result = accentToRegex('a\\b');
		expect(result).toContain('\\\\');
	});

	// Actual regex matching tests
	test('created regex pattern matches strings with accents', () => {
		const regexPattern = new RegExp(accentToRegex('casa'), 'i');

		expect(regexPattern.test('casa')).toBe(true);
		expect(regexPattern.test('cása')).toBe(true);
		expect(regexPattern.test('càsa')).toBe(true);
		expect(regexPattern.test('casá')).toBe(true);
		expect(regexPattern.test('çasa')).toBe(true);
		expect(regexPattern.test('cãšâ')).toBe(true);

		expect(regexPattern.test('home')).toBe(false);
		expect(regexPattern.test('case')).toBe(false);
	});

	test('matches words with different accent combinations', () => {
		const regexPattern = new RegExp(accentToRegex('educacao'), 'i');

		expect(regexPattern.test('educacao')).toBe(true);
		expect(regexPattern.test('educação')).toBe(true);
		expect(regexPattern.test('èdúcáçãõ')).toBe(true);
		expect(regexPattern.test('EDUCAÇÃO')).toBe(true);

		expect(regexPattern.test('edution')).toBe(false);
	});

	test('created pattern works as part of larger regex', () => {
		const word = 'rua';
		const regexPattern = new RegExp(`^${accentToRegex(word)}\\s`, 'i');

		expect(regexPattern.test('rua central')).toBe(true);
		expect(regexPattern.test('rúa norte')).toBe(true);
		expect(regexPattern.test('ruà sul')).toBe(true);

		expect(regexPattern.test('ruacentral')).toBe(false); // No space after
		expect(regexPattern.test('avenida rua')).toBe(false); // Doesn't start with "rua"
	});

	// Enhanced functionality tests
	test('handles Spanish ñ character', () => {
		const regexPattern = new RegExp(accentToRegex('espana'), 'i');

		expect(regexPattern.test('espana')).toBe(true);
		expect(regexPattern.test('españa')).toBe(true);
	});

	test('properly escapes all regex special characters', () => {
		const result = accentToRegex('[test].with*special(chars){1}^$+?/');

		expect(result).toContain('\\[');
		expect(result).toContain('\\]');
		expect(result).toContain('\\.');
		expect(result).toContain('\\*');
		expect(result).toContain('\\(');
		expect(result).toContain('\\)');
		expect(result).toContain('\\{');
		expect(result).toContain('\\}');
		expect(result).toContain('\\^');
		expect(result).toContain('\\$');
		expect(result).toContain('\\+');
		expect(result).toContain('\\?');
		expect(result).toContain('\\/');
	});

	test('works with complex search patterns', () => {
		const searchTerm = 'rua.joão 23';
		const regexPattern = new RegExp(accentToRegex(searchTerm), 'i');

		expect(regexPattern.test('rua.joão 23')).toBe(true);
		expect(regexPattern.test('ruA.João 23')).toBe(true);

		expect(regexPattern.test('rua joão 23')).toBe(false); // Missing dot
		expect(regexPattern.test('rua.joao 24')).toBe(false); // Different number
	});
});
