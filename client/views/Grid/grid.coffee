Session.setDefault('selectedRecords', [])

Template.grid.helpers
	data: ->
		return Models[this.meta?.document?.name]?.find()

	getValue: (record, fieldName) ->
		return record[fieldName]

	isLockColumn: (column) ->
		return column.linkField is 'code'

	getAlign: (field) ->
		if field.type in ['autoNumber', 'money', 'number', 'percentage']
			return 'right'
		return 'left'

	getMinWidth: (column) ->
		return parseInt(column.minWidth) or 150

	getLockWidth: (columns) ->
		width = 40
		if columns?
			for column in columns
				if column.linkField is 'code'
					width += parseInt(column.minWidth) or 150

		return width

	renderValue: (template) ->
		{meta, column, record} = template.hash
		field = meta.document.fields[column.linkField]
		if not field?
			return ''

		value = record[column.linkField]
		if renderers[field.type]?
			if field.isList is true
				renderedValue = renderers.list(value, field)
			else
				renderedValue = renderers[field.type](value, field) or ''

			if field.isList is true and renderedValue? and renderedValue isnt '' and value.length > 1
				return '<div class="cell list-cell"><div class="list-cell-plus"><i class="fa fa-plus-square-o"></i></div><div class="list-cell-item">' + renderedValue + '</div></div>'
			else
				return '<div class="cell">' + renderedValue + '</div>'

		return '<div class="cell">' + field.type + '</div>'

	selectedRecordId: ->
		return Session.get('CurrentRecord')?._id

	selectedRecords: ->
		return Session.get('selectedRecords')

	idIsSelected: (id) ->
		return Session.get('selectedRecords').indexOf(id) > -1

Template.grid.events
	'changed .left header konecty-checkbox': (e) ->
		Grid.toggleAll(e.currentTarget)

	'click .main .body tr': (e) ->
		Session.set 'CurrentRecord', this
		Grid.setCurrent(e.currentTarget)

	'dblclick .main .body tr': (e) ->
		Grid.clearSelections()
		Grid.toggleCheckbox(e.currentTarget)

	'changed .body .checkbox > konecty-checkbox': (e) ->
		selectedRecords = Session.get('selectedRecords')
		Grid.setSelected(e.currentTarget)
		if e.originalEvent.detail.value is true
			selectedRecords.push e.currentTarget.name
		else
			selectedRecords = _.without selectedRecords, e.currentTarget.name
		Session.set('selectedRecords', selectedRecords)

	'mouseenter .grid .left tbody > tr': (e) ->
		Grid.mouseEnter(e.currentTarget)

	'mouseleave .grid .left tbody > tr': (e) ->
		Grid.mouseLeave(e.currentTarget)

	'mouseenter .grid .main tbody > tr': (e) ->
		Grid.mouseEnter(e.currentTarget)

	'mouseleave .grid .main tbody > tr': (e) ->
		Grid.mouseLeave(e.currentTarget)

	'click .list-cell-plus': (e) ->
		values = this.record[this.column.linkField]
		if values?.length <= 1
			return

		field = this.meta.document.fields[this.column.linkField]

		values = _.map values, (value) ->
			return renderers[field.type](value, field) or ''

		Tooltip.show
			el: e.currentTarget
			text: values.join(', ')
			type: "list left"

		e.preventDefault()
		e.stopPropagation()
