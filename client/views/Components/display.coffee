class @Component.field.display extends KonectyFieldComponent
	@register 'Component.field.display'

	mixins: -> [
		new Mixin.Class ['display']
		Mixin.Label
		Mixin.Name
		Mixin.Value
	]

	getValue: ->
		return @value.get()

	isValid: ->
		return true