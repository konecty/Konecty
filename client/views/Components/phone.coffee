class @Component.field.phone extends KonectyFieldComponent
	@register 'Component.field.phone'

	mixins: -> [
		new Mixin.Class []
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'value-changed .cp-component-field-text': @onValueChanged
		'value-changed .cp-component-field-select': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	getOptions: ->
		return [
			{label:'+55', value: '55'}
			{label:'+1' , value: '1'}
			{label:'+39', value: '39'}
			{label:'+44', value: '44'}
			{label:'+49', value: '49'}
		]

	getPhoneNumber: ->
		return @value.get()?.phoneNumber

	getCountryCode: ->
		countryCode = @value.get()?.countryCode
		if countryCode?
			countryCode = String countryCode
		return countryCode

	getValue: ->
		countryCode = @child?.countryCode?.getValue()
		phoneNumber = @child?.phoneNumber?.getValue()

		if countryCode? and phoneNumber?
			return {
				countryCode: parseInt countryCode
				phoneNumber: phoneNumber
			}

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			if value? and value.phoneNumber.length < 10
				@setValid false, 'invalid-phone-number'
			else
				@setValid true
