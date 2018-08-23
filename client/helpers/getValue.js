/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('getValue', (obj, key) =>
	({
		key,
		value: (obj != null ? obj[key] : undefined)
	})
);

UI.registerHelper('getArrayValue', (obj, key) =>
	({
		key,
		value: [].concat(((obj != null ? obj[key] : undefined) || []))
	})
);