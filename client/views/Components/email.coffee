class @Component.field.email extends KonectyFieldComponent
	@register 'Component.field.email'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	buttons: -> [
		{icon: "envelope-o", class: "icon small", onClick: @mailto.bind(@)}
	]

	events: -> [
		'value-changed .cp-component-field-text': @onValueChanged
		'value-changed .cp-component-field-select': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	getOptions: ->
		return [
			"Trabalho"
			"Residencial"
		]

	mailto: ->
		window.location.href = "mailto:" + @getAddress()

	getAddress: ->
		return @value.get()?.address

	getType: ->
		return @value.get()?.type

	getValue: ->
		if not @isRendered()
			return @value.curValue

		address = @child?.address?.getValue()
		if address?
			value =
				address: address

			type = @child?.type?.getValue()

			if type?
				value.type = type

			return value

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			if value? and Match.test(value.address, String) and not value.address.match(/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i)
				@setValid false, 'invalid-email'
			else
				@setValid true
