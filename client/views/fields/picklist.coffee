Template.fieldPicklist.helpers
	singleSelect: (field) ->
		return field.maxSelected is 1

	withScroll: (visual, field) ->
		if visual?.renderAs?
			return visual.renderAs is 'with_scroll'
		return field.renderAs is 'with_scroll'
