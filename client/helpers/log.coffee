UI.registerHelper 'log', (args..., spacebars) ->
	return console.log.apply console, args