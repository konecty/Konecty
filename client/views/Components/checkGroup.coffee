class @Component.field.checkGroup extends KonectyFieldComponent
	@register 'Component.field.checkGroup'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	getOptions: ->
		data = @data()
		options = []
		if Match.test(data.options, Object)
			options = ({value: value, label: label} for value, label of data.options)
		else if Match.test(data.options, [Object])
			options = data.options

		options = _.sortBy options, (item) ->
			return Blaze._globalHelpers.i18n item.label

		return options

	isChecked: (name) ->
		value = @value.get()
		if _.isArray value
			return {
				checked: name in value
			}
		return {checked: false}

	getValue: ->
		values = []
		@componentChildren().forEach (cp) ->
			if cp.getValue() is true
				values.push cp.getName()

		if values.length is 0
			values = undefined
		return values