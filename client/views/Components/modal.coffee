class @Modal extends KonectyComponent
	@register 'Modal'

	mixins: -> [
		new Mixin.Class [
			'modal'
			'hidden'
		]
		new Mixin.Transitions
	]

	checkAttributes: ->
		data = @data()
		@callFirstWith(@, 'addClass', 'progress') if data.progress
		@callFirstWith(@, 'addClass', 'centered') if data.centered
		@callFirstWith(@, 'addClass', 'clean') if data.clean

	onCreated: ->
		@cancel = ""
		@opened = false
		@setTemplate()
		@open()
		# @checkAttributes()

	onRendered: ->
		@element = @firstNode()

	events: -> [
		"click .cp-button.cancel": @close
		"click .cp-button.close": @close
	]

	getTemplate: () ->
		data = @data()
		return {
			header: data.header
			footer: data.footer
		}

	getData: () ->
		data = @data()
		return {
			header: data.header
			body: data.body
			footer: data.footer
		}

	setTemplate: (name) ->

	open: ->
		@opened = true
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