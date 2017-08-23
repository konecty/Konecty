UI.registerHelper 'firstItem', (value) ->
	if value?.length?
		return value[0]
		# return Template._firstItem_wrapInDiv
	# return Template._firstItem_noop