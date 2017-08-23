UI.registerHelper 'scrollbarMeasure', ->
	scrollbarWidth = Session.get 'scrollbarWidth'
	if scrollbarWidth?
		return scrollbarWidth

	# Create the measurement node
	scrollDiv = document.createElement 'div'
	scrollDiv.className = 'scrollbar-measure'
	document.body.appendChild scrollDiv

	# Get the scrollbar width
	scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
	Session.set 'scrollbarWidth', scrollbarWidth

	# Delete the DIV
	document.body.removeChild scrollDiv

	return scrollbarWidth
