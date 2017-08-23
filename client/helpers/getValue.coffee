UI.registerHelper 'getValue', (obj, key) ->
	return {
		key: key
		value: obj?[key]
	}

UI.registerHelper 'getArrayValue', (obj, key) ->
	return {
		key: key
		value: [].concat (obj?[key] or [])
	}