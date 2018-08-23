/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('firstItem', function(value) {
	if ((value != null ? value.length : undefined) != null) {
		return value[0];
	}
});
		// return Template._firstItem_wrapInDiv
	// return Template._firstItem_noop