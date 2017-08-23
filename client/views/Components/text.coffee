Mask = do ->
	run = (type, input, params = {}) ->
		window.$.mask.definitions['1'] = '[0-1]'
		window.$.mask.definitions['2'] = '[0-2]'
		window.$.mask.definitions['3'] = '[0-3]'
		window.$.mask.definitions['5'] = '[0-5]'
		if input
			$input = window.$(input)
		switch type
			when 'currency'
				tag = 'update'
				if input.initialized isnt true
					input.initialized = true
					tag = 'init'

				$input.autoNumeric tag,
					aSign: (params.symbol or 'R$') + ' '
					aDec: ','
					aSep: '.'
					mDec: 2
					pattern: 'd*'
			when 'cep'
				$input.mask('99999-999', autoclear: false).remask()
			when 'phone'
				$input.mask('(99) 9999-9999?9', autoclear: false)
			when 'cpf'
				$input.mask('999.999.999-99', autoclear: false).remask()
			when 'date'
				$input.mask('39/19/2999', autoclear: false)
			when 'time'
				$input.mask('29:59:59', autoclear: false)
			when 'percentage'
				tag = 'update'

				if input.value.trim() is ''
					return

				if input.initialized isnt true
					input.initialized = true
					tag = 'init'

				$input.autoNumeric tag,
					aSign: ' %'
					aDec: ','
					aSep: '.'
					mDec: 2
					pSign: 's'
					pattern: 'd*'

	run: run

Validate = do ->
	number = (type, element) ->
		value = element.value.trim()

		if value.match(/^[0-9]*$/) and type is "number"
			return true

		return false

	run = (type, element) ->
		check = true
		switch type
			when 'number'
				check = number(type, element)
		return check

	run: run

class @Component.field.text extends KonectyFieldComponent
	@register 'Component.field.text'

	setValueMatch: Match.OneOf(String, Number, undefined)

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	onCreated: ->
		@value = new ReactiveVar
		@inputType = new ReactiveVar

	checkType: ->
		if @type is "password"
			@inputType.set "password"
		else
			@inputType.set "text"

	checkAttributes: ->
		data = @data()
		@input = @firstNode().querySelector("input")
		@callFirstWith(@, 'addClass', data.class) if data.class
		@callFirstWith(@, 'addClass', "btns-" + data.buttons.length) if data.buttons

	onRendered: ->
		@checkAttributes()
		Meteor.autorun =>
			data = @data() or {}
			@type = data.type or data.field?.type or "text"
			@checkType()
			Meteor.defer =>
				Mask.run @type, @input

	events: -> [
		"click label": ->
			@input.focus()

		"keyup input": ->
			@validate()
			Meteor.defer =>
				@fireEvent 'value-changed'

		"blur input": ->
			@input.value = @input.value.trim()
	]

	validate: ->
		if @preventValidation is true
			return

		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			if not Validate.run @type, @input
				@setValid false
			else
				@setValid true

	realValue: ->
		return @input?.value.trim()

	getTemplateValue: ->
		value = @value.get()
		if @type in ['currency', 'percentage']
			value = String(value).replace('.', ',')

		return value

	getValue: ->
		value = @input?.value.trim()
		switch @type
			when 'number'
				value = parseInt value
				if not _.isNaN value
					return value
				return

			when 'currency', 'percentage'
				if not value? or value.replace(/[^\d]/g, '') is ''
					return null

				value = parseFloat value.replace(/[^\d,]/g, '').replace(',','.')

				if _.isNaN value
					return

				return  value

			when 'phone'
				value = value.replace(/[^\d]/g, '').trim()
				if value is ''
					return undefined
				return value

			else
				if value?.trim?() is ""
					return
				else
					return value
