class @Component.field.listItem extends KonectyComponent
	@register 'Component.field.listItem'

	events: -> [
		'click button.remove-item': @removeItem
		'value-changed .list-component-area > .component': @changedValueOfItem
	]

	onCreated: ->
		@valid = new ReactiveVar true

		parent = @componentParent()
		parent.items.push @
		parent.updateIsValid()

	onRendered: ->
		parent = @componentParent()
		comp = @componentChildren()[0]
		if comp instanceof KonectyFieldComponent
			Tracker.autorun =>
				@valid.set comp.valid.get()
				parent.updateIsValid()

	onDestroyed: ->
		parent = @componentParent()
		parent.items = _.without parent.items, @
		parent.updateIsValid()

	changedValueOfItem: (e) ->
		cp = @getComponentFromEvent(e)
		@data().parentData?.curValue = cp.getValue()
		@fireEvent 'value-changed'

	removeItem: ->
		parentValue = @componentParent().value
		value = _.without parentValue.curValue, @data().parentData
		parentValue.set value

	isDirty: ->
		comp = @componentChildren()[0]
		if not (comp instanceof KonectyFieldComponent)
			return false

		return comp.isDirty()
