class @Mixin.Class extends BlazeComponent
	constructor: (classes = []) ->
		classes = ['component'].concat classes
		@cls = new ReactiveVar(classes)

	onCreated: ->
		mixinParent = @mixinParent()

		Tracker.autorun ->
			data = mixinParent.data()
			if data?.class?
				classes = data.class.split ' '
				for item in classes
					mixinParent.callFirstWith null, 'addClass', item

	getComponentName: (mixinParent) ->
		mixinParent ?= @mixinParent()
		return mixinParent.componentName().replace(/([^A-Z]+)([A-Z])/g, '$1-$2').replace(/\./g, '-').replace(/[-]{2,}/g, '-').toLowerCase()

	mixinParent: (mixinParent) ->
		if mixinParent?
			@addClass 'cp-' + @getComponentName(mixinParent)
		super

	onRendered: ->
		node = @mixinParent().firstNode()
		if node.id is ""
			compName = @getComponentName()
			KonectyComponent.ids[compName] ?= 0
			node.id = compName + '-' + ++KonectyComponent.ids[compName]

	addClass: (newClass) ->
		if @cls.curValue.indexOf(newClass) is -1
			@cls.set @cls.curValue.concat(newClass)

	getClass: ->
		return @cls.get().join ' '

	removeClass: (oldClass) ->
		@cls.set _.without(@cls.curValue, _.findWhere(@cls.curValue, oldClass))
