import moment from 'moment';

class @Component.field.date extends KonectyFieldComponent
	@register 'Component.field.date'

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

	getFormated: (date) ->
		if not date?.getDate?
			return ''

		return moment(date).format('L')

	checkDate: (value) ->
		if not value?
			return

		value = value.replace(/[_]+/ig, '').trim()
		if value.replace(/[^0-9]/g, '') is ''
			return

		value = value.split('/')
		date = new Date()
		if value.length is 3
			if not value[1]? or value[1].length is 0
				value[1] = date.getMonth() + 1

			if not value[2]? or value[2].length is 0
				value[2] = date.getFullYear()
			else if value[2].length is 2
				value[2] = "20" + value[2]

			return new Date(value[2], value[1] - 1, value[0])

	getValue: ->
		return @checkDate @child?.date?.getValue()

	getTemplateValue: ->
		return @getFormated @value.get()

	getValueFormated: ->
		return @getFormated @getValue()

	validate: ->
		if @preventValidation is true
			return

		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true
