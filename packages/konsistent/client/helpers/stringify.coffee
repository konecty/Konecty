UI.registerHelper 'stringify', (obj) ->
	return JSON.stringify obj, null, '  '