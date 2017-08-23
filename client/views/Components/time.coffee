import moment from 'moment';

class @Component.field.time extends KonectyFieldComponent
	@register 'Component.field.time'

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

	onBlur: ->
		Meteor.defer =>
			@value.set @getValue()
			@validate()

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	check: ->
		value = @child.time.realValue()
		checked = @checkTime(@child.time.realValue())
		if checked
			@child.time.setValue(checked)
			@child.time.validate()
			return true

		return false

	msToTime: (ms) ->
		if ms?
			return moment().startOf('day').add(ms).format('HH:mm:ss')
		return ''

	timeToMs: (time) ->
		time = time.split(':')
		return moment().startOf('day').add(time[0], 'hours').add(time[1], 'minutes').add(time[2], 'seconds').toDate().getTime() - moment().startOf('day').toDate().getTime()

	checkTime: (value) ->
		value = value.replace(/[_]+/ig, "").split(":")
		if value.length is 3
			if String(value[0]).length is 1
				value[0] = "0" + value[0]

			switch String(value[1]).length
				when 0 then value[1] = "00"
				when 1 then value[1] = "0" + value[1]

			switch String(value[2]).length
				when 0 then value[2] = "00"
				when 1 then value[2] = "0" + value[2]

			return value.join(":")

		return false

	setValue: (ms) ->
		if not ms?
			@value.set undefined
			return

		ms = parseInt(ms)
		if ms >= 0
			@value.set ms

	getValue: ->
		if not @isRendered()
			return @value.curValue

		value = @child.time.getValue()
		if /[0-9]{2}:[0-9]{2}:[0-9]{2}/.test value
			return @timeToMs value
		return undefined

	getValueFormated: ->
		return @msToTime(@value.get())

	validate: ->
		if @preventValidation is true
			return

		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true
