class filters extends KonectyComponent
	@register 'filters'

	events: -> [
		"click .open-modal": @openModal
		"click .control": @toggleVisibility
		"click .fa-filter": @filter
		"keyup input": @keyup
	]

	toggleVisibility: (e) ->
		e.preventDefault()
		e.stopPropagation()
		Layout.filters.toggle()

	openModal: (e) ->
		$("konecty-modal").get(0).open()

	keyup: (e) ->
		key = e.which

		if key is 13
			@filter()

	filter: ->
		filter = {}

		for child in this.componentChildren()
			if child.componentName() is 'filterItem' and child.child?.value?
				if child.child.checkbox.getValue() is true
					data = child.child.value.data()
					name = data.field.name
					type = data.field.type
					value = child.child.value.getValue()

					if not value? or (Match.test(value, String) and value.trim() is '')
						continue

					if type is 'autoNumber'
						value = parseInt value

					filter[name] = value

		console.log filter
		Session.set 'filter', filter