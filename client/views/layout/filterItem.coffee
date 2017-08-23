class filterItem extends KonectyComponent
	@register 'filterItem'

	getFieldNameForTemplate: (field) ->
		name = 'field' + _.capitalize field.type

		newComponents =
			autoNumber: 'Component.field.text'
			boolean: 'Component.field.switch'
			date: 'Component.field.date'
			dateTime: 'Component.field.dateTime'
			email: 'Component.field.text'
			money: 'Component.field.currency'
			number: 'Component.field.text'
			percentage: 'Component.field.percentage'
			personName: 'Component.field.text'
			phone: 'Component.field.text'
			text: 'Component.field.text'
			time: 'Component.field.time'
			url: 'Component.field.text'
			lookup: 'Component.field.select'

		if newComponents[field.type]
			name = newComponents[field.type]

		template = Template[name]
		if template?
			return name
		return 'fieldNull'


	events: -> [
		"value-changed .component": _.throttle @valueChanged, 200
	]

	valueChanged: ->
		@child.checkbox.setValue true
