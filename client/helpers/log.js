/*
 * decaffeinate suggestions:
 * DS201: Simplify complex destructure assignments
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('log', function(...args1) {
	const adjustedLength = Math.max(args1.length, 1),
		args = args1.slice(0, adjustedLength - 1),
		spacebars = args1[adjustedLength - 1];
	return console.log.apply(console, args);
});