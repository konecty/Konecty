UI.registerHelper 'concat', (args...) ->
	args.pop()
	return args.join ''