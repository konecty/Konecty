class @Component.field.url extends KonectyFieldComponent
	@register 'Component.field.url'

	setValueMatch: Match.Optional(String)

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	buttons: -> [
		{icon: "link", class: "icon small", onClick: @goTo.bind(@)}
	]

	events: -> [
		'value-changed .cp-component-field-text': @onValueChanged
		'value-changed .cp-component-field-select': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	checkString: (str) ->
		parts = str?.match(/^(HTTP|HTTPS|FTP|SSH)(\:\/\/)(.+)/i)
		if parts?
			return {
				url: parts[3]
				protocol: parts[1]
			}
		return {}

	getOptions: ->
		return [
			'http'
			'https'
			'ftp'
			'ssh'
		]

	goTo: ->
		window.open @getValue()

	# parseUrl: (url) ->
	# 	if not url?
	# 		return {}

	# 	check = @checkString(url)

	# 	if check isnt false
	# 		check.protocol = check.protocol.toLowerCase()
	# 		check.url = check.url.toLowerCase()

	# 	return {
	# 		value: if check.protocol then check.protocol + "://" + check.url else check.url
	# 		selected: check.protocol
	# 		url: check.url
	# 	}

	getProtocol: ->
		return @checkString(@value.get()).protocol

	getUrl: ->
		return @checkString(@value.get()).url

	getValue: ->
		url = @child?.url?.getValue()
		protocol = @child?.protocol?.getValue()

		if url? and protocol?
			return "#{protocol}://#{url}"

		return

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			urlRegExp = new RegExp('^' + '(?:(?:https?|ftp|ssh)://)' + '(?:\\S+(?::\\S*)?@)?' + '(?:' + '(?!(?:10|127)(?:\\.\\d{1,3}){3})' + '(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' + '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' + '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' + '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' + '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' + '|' + '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' + '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' + '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' + ')' + '(?::\\d{2,5})?' + '(?:/\\S*)?' + '$', 'i')
			if Match.test(value, String) and not value.match(urlRegExp)
				@setValid false, 'invalid-url'
			else
				@setValid true
