class @Component.field.personName extends KonectyFieldComponent
	@register 'Component.field.personName'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'value-changed .cp-component-field-text': @onValueChanged
	]

	onValueChanged: ->
		@validate()
		@fireEvent 'value-changed'

	getTemplateValue: ->
		return @value.get()

	getValue: ->
		first = @child?.first?.getValue()

		value = undefined
		if first?
			value =
				first: first

			last = @child?.last?.getValue()
			if last?
				value.last = last
				value.full = first + ' ' + last

		return value

	validate: ->
		value = @getValue()
		if not value?.first? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true