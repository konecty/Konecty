class @Component.field.percentage extends KonectyFieldComponent
	@register 'Component.field.percentage'

	mixins: -> [
		new Mixin.Class ['holder']
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'blur input': @onBlur
		'value-changed .cp-component-field-text': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	onBlur: ->
		@value.set @getValue()

	getPercentValue: ->
		value = @value.get()
		if value?
			return value * 100
		return ''

	getValue: ->
		value = @componentChildren()[0].getValue()
		if not value?
			return

		value = value / 100
		if not _.isNaN value
			return value

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true
