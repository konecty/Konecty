class @Component.field.currency extends KonectyFieldComponent
	@register 'Component.field.currency'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
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
			'BRL'
			'USD'
			'EUR'
		]

	getCurrencyValue: ->
		return @value.get()?.value

	getCurrency: ->
		return @value.get()?.currency

	getValue: ->
		currency = @child?.currency?.getValue()
		value = @child?.value?.getValue()

		if currency? and value?
			return {
				currency: currency
				value: value
			}

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true
