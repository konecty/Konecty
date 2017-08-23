UI.registerHelper 'i18n', (args...) ->
	language = navigator.language or navigator.userLanguage

	for obj in args
		if _.isString obj
			return obj

		if _.isObject obj
			val = obj[language] or obj[language.replace('-', '_')] or obj[language.split('-')[0]] or obj.en or _.values(obj)[0]
			if val?
				return val