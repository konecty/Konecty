class @Component.field.switch extends KonectyFieldComponent
	@register 'Component.field.switch'

	mixins: -> [
		new Mixin.Class ['holder']
		Mixin.Label
		Mixin.Name
		Mixin.Value
	]

	events: -> [
		"click label": -> @toggle()
		"click .switch > i": -> @toggle()
	]

	setValue: (value) ->
		@value.set value

		if @value.curValue is true
			@callFirstWith(@, 'addClass', 'checked')
		else
			@callFirstWith(@, 'removeClass', 'checked')

	getValue: ->
		return @value.get()

	toggle: ->
		@setValue not @value.curValue

	isValid: ->
		return true
