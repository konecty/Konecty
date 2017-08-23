class @Mixin.Label extends BlazeComponent
	onCreated: ->
		mixinParent = @mixinParent()
		if mixinParent.data()?.label?
			mixinParent.callFirstWith mixinParent, 'addClass', 'labeled'

	getLabel: ->
		data = @mixinParent().data()
		if _.isObject data.label
			return Blaze._globalHelpers.i18n data.label
		return data.label

	getLabelHtml: ->
		mixinParent = @mixinParent()
		label = mixinParent.callFirstWith null, 'getLabel'
		if label?
			return """
				<label>
					<span>#{label}</span>
				</label>
			"""
		return ""