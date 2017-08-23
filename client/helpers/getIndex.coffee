UI.registerHelper 'getIndex', (value, arr) ->
	return {
		index: arr.indexOf value
		value: value
	}