UI.registerHelper 'arrayify', (obj) ->
	result = []
	for key, value of obj
		result.push 
			key: key
			value: value

	return result