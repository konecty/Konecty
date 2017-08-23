class @Mixin.Validation extends BlazeComponent
	onCreated: ->
		mixinParent = @mixinParent()
		mixinParent.valid = new ReactiveVar true
		mixinParent.isRequired = new ReactiveVar false
		mixinParent.preventValidation = false

		Tracker.autorun =>
			data = mixinParent.data() or {}

			if data.preventValidation is true
				mixinParent.preventValidation = true

		if not mixinParent.isValid?
			mixinParent.isValid = ->
				return @callFirstWith @, 'isValid'

		if not mixinParent.setValid?
			mixinParent.setValid = (valid, message) ->
				return @callFirstWith @, 'setValid', valid, message

	onRendered: ->
		mixinParent = @mixinParent()

		Tracker.autorun =>
			valid = mixinParent.valid.get()
			if valid is true
				mixinParent.callFirstWith null, 'removeClass', 'invalid'
			else
				mixinParent.callFirstWith null, 'addClass', 'invalid'

		Tracker.autorun =>
			isRequired = mixinParent.isRequired.get()
			if isRequired is true
				mixinParent.callFirstWith null, 'addClass', 'required'
			else
				mixinParent.callFirstWith null, 'removeClass', 'required'

		Tracker.autorun =>
			data = mixinParent.data()
			if data?.field?.isRequired?
				mixinParent.isRequired.set data.field.isRequired is true

		Tracker.autorun =>
			isRequired = mixinParent.isRequired.get()
			if Match.test mixinParent.child, Object
				for name, child of mixinParent.child
					if child.isRequired?
						child.isRequired.set isRequired

	isValid: ->
		mixinParent = @mixinParent()
		return mixinParent.valid.curValue

	setValid: (valid, message=false) ->
		mixinParent = @mixinParent()
		if valid is true
			mixinParent.valid.set true
		else
			mixinParent.valid.set message

		if Match.test mixinParent.child, Object
			for name, child of mixinParent.child
				if child.setValid?
					child.setValid(valid)