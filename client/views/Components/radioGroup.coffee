class @Component.field.radioGroup extends KonectyFieldComponent
	@register 'Component.field.radioGroup'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'konecty-change .cp-component-field-radio': @onChange
	]

	onChange: (event) ->
		cp = @getComponentFromEvent event
		if cp.value.curValue is true
			for child in @componentChildren() when child isnt cp
				child.setValue false

	getOptions: ->
		data = @data()
		if Match.test(data.options, Object)
			return ({value: value, label: label} for value, label of data.options)

		return data.options

	isChecked: (name) ->
		value = @value.get()
		return {
			checked: name is value
		}

	getValue: ->
		for child in @componentChildren()
			if child.getValue() is true
				return child.getName()
