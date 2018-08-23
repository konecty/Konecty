/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('i18n', function(...args) {
	const language = navigator.language || navigator.userLanguage;

	for (let obj of Array.from(args)) {
		if (_.isString(obj)) {
			return obj;
		}

		if (_.isObject(obj)) {
			const val = obj[language] || obj[language.replace('-', '_')] || obj[language.split('-')[0]] || obj.en || _.values(obj)[0];
			if (val != null) {
				return val;
			}
		}
	}
});