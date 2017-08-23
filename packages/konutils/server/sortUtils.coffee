sortUtils = {}

sortUtils.parseSortArray = (sortArray) ->
	sort = {}

	if not _.isArray sortArray
		sortArray = [].concat sortArray

	_.each sortArray, (item) ->
		item.direction ?= 'ASC'
		sort[item.property or item.term] = if item.direction.toUpperCase() is 'ASC' then 1 else -1

	return sort
