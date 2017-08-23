class @Component.field.password extends KonectyFieldComponent
	@register 'Component.field.password'

	mixins: -> [
		new Mixin.Class [
			'holder'
			'hidden'
		]
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	events: -> [
		'blur input': @onBlur
		'keyup .password input': @keyUp
		'keydown .password input': @keyDown
		'keyup .confirmation input': @keyUp
		'keydown .confirmation input': @keyDown
		'value-changed .cp-component-field-text': @onValueChanged
	]

	onValueChanged: ->
		@fireEvent 'value-changed'
		@validate()

	keyUp: ->
		console.log "KEY UP"
		@checkValue()

	keyDown: (e) ->
		if e.which is 13 and @confirmationVisible is true
			e.preventDefault()
			e.stopPropagation()
			@confirmation.focus()

	onCreated: ->
		@securityLevel = 0
		@status = new ReactiveVar("LOL")

	onRendered: ->
		@element = @firstNode()
		@password = @element.querySelector(".password input")
		@confirmation = @element.querySelector(".confirmation input")
		@confirmationVisible = false
		@securityLevel = 0

	checkAttributes: ->
		data = @data()
		@setValue(data.value) if data.value

	checkValue: ->
		@checkSecurity()
		@checkConfirmation()
		@confirmationVisible = @securityLevel >= 5
		@checkStatus()
		if @statusVisible then @callFirstWith(@, 'addClass', "status") else @callFirstWith(@, 'removeClass', "status")
		if @strengthVisible then @callFirstWith(@, 'addClass', "strength") else @callFirstWith(@, 'removeClass', "strength")
		if @confirmationVisible then @callFirstWith(@, 'removeClass', "hidden") else @callFirstWith(@, 'addClass', "hidden")

	checkConfirmation: ->
		password = @password.value.trim()
		confirmation = @confirmation.value.trim()

		if password isnt "" and password isnt confirmation
			@confirmation.invalid = true
		else
			@confirmation.invalid = false

	checkSecurity: ->
		passValue = @password.value
		strength = 0
		if passValue
			if passValue.length >= 6
				strength += 2
			if passValue.length >= 8
				strength += 1
			if passValue.length >= 10
				strength += 1
			if passValue.match(/[\W]/g)
				strength += 2
			if passValue.match(/[A-Z]/g)
				strength += 1
			if passValue.match(/[a-z]/g)
				strength += 1
			if passValue.match(/[0-9]/g)
				strength += 1
		@callFirstWith(@, 'removeClass', '_' + @securityLevel)
		@securityLevel = if strength > 10 then 10 else strength
		@callFirstWith(@, 'addClass', '_' + @securityLevel)

	checkStatus: ->
		passValue = @password.value
		console.log "STATUS GET"
		console.log @status.get()
		if passValue?
			@strengthVisible = true
			if passValue.length > 0 and @securityLevel < 5
				@statusVisible = true
				@status.set("Senha muito fraca")
				return
			else
				if @confirmationVisible is true and @confirmation.invalid is false
					@statusVisible = true
					@status.set("Senha válida")
					return
				# if isdirty
				if @confirmationVisible is true and @confirmation.invalid is true
					@statusVisible = true
					@status.set("Confirme sua senha")
					return
				@status.set("")
		else
			@strengthVisible = false
		@statusVisible = false

	onBlur: ->
		# @value.set @componentChildren()[0].realValue()

	getTemplateValue: ->
		return @value.get()

	getValue: ->
		if not @isRendered()
			return @value.curValue

		if @confirmation.invalid is false
			value = @password.value.trim()
			if value isnt ""
				return value
		return undefined

	validate: ->
		if @confirmation?.invalid is true 
			@setValid false, 'invalid-password'
		else
			value = @getValue()
			if not value? and @isRequired.get() is true
				@setValid false, 'field-required'
			else
				@setValid true

