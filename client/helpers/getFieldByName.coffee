UI.registerHelper 'getFieldByName', (meta, name) ->
	return meta?.fields?[name?.split('.')[0]]