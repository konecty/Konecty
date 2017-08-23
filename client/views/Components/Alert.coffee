class @Alert extends KonectyComponent
	@register 'Alert'

	mixins: -> [
		new Mixin.Class [
			'modal'
			'progress'
			'centered'
			'clean'
		]
		new Mixin.Transitions
	]

	checkAttributes: ->
		data = @data()
		@type.set(data.type or @params.type or "alert")
		@title.set(data.title or @params.title or "")
		@actionText.set(data.actionText or @params.actionText or "Send")
		@cancelText.set(data.cancelText or @params.cancelText or "Cancel")
		@closeText.set(data.closeText or @params.cancelText or "Close")

	onCreated: ->
		data = @data()
		@params = data.params or {}
		@opened = false
		@message = new ReactiveVar(data.message or @params.message or "")
		@input = new ReactiveVar(false)
		@actionVisible = new ReactiveVar(false)
		@cancelVisible = new ReactiveVar(false)
		@closeVisible = new ReactiveVar(false)
		@actionText = new ReactiveVar("")
		@cancelText = new ReactiveVar("")
		@closeText = new ReactiveVar("")
		@title = new ReactiveVar("")
		@type = new ReactiveVar("")
		@checkAttributes()
		@checkType()

	onRendered: ->
		@element = @firstNode()
		# @open()

	events: -> [
		"click .cp-button.cancel": @action
		"click .cp-button.close": @close
		"click .cp-button.action": @action
	]

	getInputValue: ->
		input = BlazeComponent.getComponentForElement @element.querySelector(".cp-component-field-text")
		return if input then input.getValue() else null

	action: (event) ->
		self = @
		@block()
		@load()

		@params.value = @getInputValue() if @type is "prompt"

		if @params.waitOn
			@params.waitOn @params, (status) ->
				setTimeout ->
					if status
						self.callFirstWith(self, 'addClass', "success")
						self.message.set self.params.successMsg
					else
						self.callFirstWith(self, 'addClass', "fail")
						self.message.set self.params.failMsg or self.params.cancelMsg
					self.complete()
				, 1
			return
		else
			if not @params.resultMessage and not @params.successMsg
				@close()
				return
			else
				# do nothing

		if event.currentTarget.classList.contains "cancel"
			@message.set @params.failMsg or @params.cancelMsg
		else
			@message.set @params.successMsg or @params.resultMessage

		setTimeout ->
			self.complete()
		, 100

	complete: ->
		self = @
		@input.set(false)
		@buttonsState(false, false, true)
		@callFirstWith(@, 'addClass', 'ended')
		if @params.autoClose
			setTimeout ->
				self.close()
			, @params.autoClose * 1000

	block: ->
		@callFirstWith(@, 'addClass', 'blocked')

	unblock: ->
		@callFirstWith(@, 'removeClass', 'blocked')

	load: ->
		self = @
		setTimeout ->
			self.callFirstWith(self, 'addClass', 'started')
		, 10

	checkType: ->
		if @type.get() is "confirm"
			@confirm()
			return
		if @type.get() is "alert"
			@alert()
			return
		if @type.get() is "prompt"
			@prompt()
			return

	confirm: ->
		@input.set false
		@buttonsState(true, true, false)

	alert: ->
		@input.set false
		@buttonsState(false, false, true)

	prompt: ->
		@input.set true
		@buttonsState(true, true, false)

	buttonsState: (action, cancel, close) ->
		@actionVisible.set action or false
		@cancelVisible.set cancel or false
		@closeVisible.set close or false

	open: ->
		@opened = true

		if @input.get() is true
			input = @element.querySelector("input")
			setTimeout ->
				input.focus()
			, 100

		@callFirstWith(@, 'addClass', 'opened')
		@callFirstWith(@, 'redraw', @element) if @element
		@callFirstWith(@, 'removeClass', 'hidden')

	close: ->
		self = @
		@opened = false
		@callFirstWith(@, 'addClass', 'hidden')
		transition = @callFirstWith(@, 'whichEvent', "transition")
		@element.addEventListener transition, (e) ->
			self.element.removeEventListener transition, arguments.callee
			self.callFirstWith(self, 'removeClass', 'opened')