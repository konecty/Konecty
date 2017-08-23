class @Mixin.Value extends BlazeComponent
	onCreated: ->
		mixinParent = @mixinParent()
		mixinParent.value = new ReactiveVar
		mixinParent.originalValue = new ReactiveVar
		mixinParent.dirty = new ReactiveVar false

		if not mixinParent.isDirty?
			mixinParent.isDirty = ->
				return @callFirstWith @, 'isDirty'

		if not mixinParent.setValue?
			mixinParent.setValue = (value) ->
				return @callFirstWith @, 'setValue', value

		Tracker.autorun ->
			data = mixinParent.data()
			if data?
				mixinParent.callFirstWith null, 'setValue', data.value
				mixinParent.callFirstWith null, 'setOriginalValue', data.value

		Tracker.autorun =>
			dirty = mixinParent.dirty.get()
			if dirty is true
				mixinParent.callFirstWith null, 'addClass', 'dirty'
			else
				mixinParent.callFirstWith null, 'removeClass', 'dirty'

			if Match.test mixinParent.child, Object
				for name, child of mixinParent.child
					if child.dirty?
						child.dirty.set dirty

	setOriginalValue: (value) ->
		if value?
			@mixinParent().originalValue.set EJSON.parse EJSON.stringify value
		else
			@mixinParent().originalValue.set value

	setValue: (value) ->
		mixinParent = @mixinParent()
		if mixinParent?
			if not mixinParent.setValueMatch? or Match.test(value, mixinParent.setValueMatch)
				mixinParent.value.set value

	getValue: (value) ->
		mixinParent = @mixinParent()
		return mixinParent.value.get()

	checkDirty: ->
		mixinParent = @mixinParent()
		oldValue = mixinParent.originalValue.curValue
		newValue = mixinParent.callFirstWith null, 'getValue'

		mixinParent.dirty.set not _.isEqual oldValue, newValue

	isDirty: ->
		mixinParent = @mixinParent()
		mixinParent.callFirstWith null, 'checkDirty'

		return mixinParent.dirty.curValue