class @KonectyComponent extends BlazeComponent
	fireEvent: (eventName) ->
		if @_componentInternals.templateInstance?
			firstNode = @firstNode()
			if firstNode?
				event = new CustomEvent eventName, {detail: {component: @}}
				@firstNode().dispatchEvent event

	getComponentFromEvent: (event) ->
		if event instanceof jQuery.Event
			event = event.originalEvent

		return event.detail?.component

	@ids: {}

	@getCmp: (selector) ->
		el = document.querySelector(selector)
		el ?= document.querySelector('#'+selector)
		if el?
			KonectyComponent.getComponentForElement(el)
