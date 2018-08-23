/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
UI.registerHelper('scrollbarMeasure', function() {
	let scrollbarWidth = Session.get('scrollbarWidth');
	if (scrollbarWidth != null) {
		return scrollbarWidth;
	}

	// Create the measurement node
	const scrollDiv = document.createElement('div');
	scrollDiv.className = 'scrollbar-measure';
	document.body.appendChild(scrollDiv);

	// Get the scrollbar width
	scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
	Session.set('scrollbarWidth', scrollbarWidth);

	// Delete the DIV
	document.body.removeChild(scrollDiv);

	return scrollbarWidth;
});
