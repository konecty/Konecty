class @Mixin.Name extends BlazeComponent
	onRendered: ->
		if @mixinParent()
			mixinParent = @mixinParent()
			@name = mixinParent.data().name
			if @name?
				componentParent = mixinParent.componentParent()
				if componentParent?
					componentParent.child ?= {}
					componentParent.child[@name] = mixinParent

		@mixinParent().getName = =>
			return @name
		super
