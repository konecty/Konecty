/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('lengthGt', function(arr, length) {
	console.log(arr, length);
	return (arr != null ? arr.length : undefined) > length;
});