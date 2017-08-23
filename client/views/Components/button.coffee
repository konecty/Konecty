class @Button extends BlazeComponent
	@register 'Button'

	mixins: -> [
		new Mixin.Class ['button']
	]

	onRendered: ->
		Tracker.autorun =>
			data = @data()
			if not data?
				return

			if data.tooltip?
				@firstNode().setAttribute "tooltip", data.tooltip

			if data.icon?
				@callFirstWith @, 'addClass', 'icon'

			if data.class
				@callFirstWith @, 'addClass', data.class

	events: -> [
		"click button": @onClick
	]

	onClick: (e) ->
		data = @data()
		if _.isFunction data.onClick
			data.onClick e, @