class @Component.field.list extends KonectyFieldComponent
	@register 'Component.field.list'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	onCreated: ->
		@items = []

	events: -> [
		'click button.add-item': @addItem
		'value-changed .list-component-area > .component': -> @fireEvent 'value-changed'
	]

	addItem: ->
		value = @value.curValue or []
		value.push new ReactiveVar

		@value.set value

	setValue: (values) ->
		if not _.isArray(values)
			values = []

		values = values.map (value) -> new ReactiveVar value

		@value.set values

	reactiveValue: ->
		return [].concat @value.get()

	updateIsValid: ->
		for item in @items
			if item.valid.curValue isnt true
				@valid.set item.valid.curValue
				return

		@valid.set true

	getValue: ->
		value = []
		for item in @reactiveValue()
			value.push item.curValue

		if value.length is 0
			return undefined
		return value

	isDirty: ->
		for item in @items
			if item.isDirty() is true
				return true

		return false