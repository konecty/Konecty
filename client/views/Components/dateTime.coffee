class @Component.field.dateTime extends KonectyFieldComponent
	@register 'Component.field.dateTime'

	mixins: -> [
		new Mixin.Class ['holder']
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'value-changed .cp-component-field-date': @onValueChanged
		'value-changed .cp-component-field-time': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	setValue: (date) ->
		if _.isString date
			date = new Date(date)

		@value.set date

	getMidnightFromDate: (date) ->
		return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)

	getTimeFromMidnight: (date) ->
		if not _.isDate date
			return 0

		zero = @getMidnightFromDate date
		return date.getTime() - zero.getTime()

	getTime: ->
		return @getTimeFromMidnight @value.get()

	getDate: ->
		return @value.get()

	getValue: ->
		time = @child?.time?.getValue()
		date = @child?.date?.getValue()

		if not date? or not time?
			return

		return new Date(@getMidnightFromDate(date).getTime() + time)

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true