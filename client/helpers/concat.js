UI.registerHelper('concat', function(...args) {
	args.pop();
	return args.join('');
});