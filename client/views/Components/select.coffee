class @Component.field.select extends KonectyFieldComponent
	@register 'Component.field.select'

	mixins: -> [
		new Mixin.Class [
			'hidden'
			'done'
		]
		new Mixin.Transitions
		Mixin.Label
		Mixin.Name
		Mixin.Value
		Mixin.Validation
	]

	onCreated: ->
		@selected = new ReactiveVar
		@items = new ReactiveVar
		@filter = new ReactiveVar
		@opened = new ReactiveVar false
		@timing = {}
		@items.set([
			{label: "Item A", value: "Item A"}
			{label: "Item B", value: "Item B"}
			{label: "Item C", value: "Item C"}
			{label: "Item D", value: "Item D"}
		])

		Tracker.autorun =>
			data = @data() or {}

			if Match.test data.options, Object
				@setItems ({value: value, label: label} for value, label of data.options)
			else if Match.test data.options, [String]
				@setItems ({value: value, label: value} for value in data.options)
			else if Match.test data.options, [Object]
				@setItems data.options

			@callFirstWith(@, 'addClass', data.class) if data.class

			if data.field?.type is 'lookup'
				@lookup =
					field: data.field
					meta: data.meta

			@buffer = data.buffer or 400
			@updateFilterBuffer = _.throttle @updateFilter, @buffer

	onRendered: ->
		@element = @firstNode()
		@input = @element.querySelector("input")
		@list = @element.querySelector("ul")

		Tracker.autorun =>
			opened = @opened.get()

			transition = @callFirstWith @, 'whichEvent', 'transition'

			if opened is true
				@callFirstWith @, 'removeClass', 'done'
				@callFirstWith @, 'removeClass', 'hidden'
			else
				Meteor.setTimeout =>
					@callFirstWith @, 'addClass', 'done'
				, 200

				@callFirstWith @, 'addClass', 'hidden'

	events: -> [
		"click .holder": @toggle

		"blur input": ->
			@opened.set false
			if @input.value.trim() is ''
				@setValue undefined

		"click li": (e) ->
			@select(e.currentTarget.getAttribute("data-value"))

		"mouseenter li": (e) ->
			e.currentTarget.classList.add("hover")

		"mouseleave li": (e) ->
			e.currentTarget.classList.remove("hover")

		"keydown input": @keyDown

		"keyup input": @keyUp
	]

	toggle: ->
		@opened.set not @opened.curValue

	next: ->
		lis = @element.querySelectorAll "li"
		next = null
		for i of lis
			if lis[i].classList?.contains "hover"
				lis[i].classList.remove "hover"
				if not lis[i*1+1]
					lis[0].classList.add "hover"
				else
					lis[i*1+1].classList.add "hover"
				return
		lis[0].classList.add "hover"

	prev: ->
		lis = @element.querySelectorAll "li"
		next = null
		for i of lis
			if lis[i].classList.contains "hover"
				lis[i].classList.remove "hover"
				if not lis[i*1-1]
					lis[lis.length-1].classList.add "hover"
				else
					lis[i*1-1].classList.add "hover"
				return
		lis[lis.length-1].classList.add "hover"

	enter: ->
		li = @element.querySelector ".hover"
		if li
			@setValue li.getAttribute("data-value")
			@toggle()
		else
			# strict test

	stop: (event) ->
		event.preventDefault()
		event.stopImmediatePropagation()
		event.stopPropagation()

	keyUp: (event) ->
		key = event.which

		if key not in [9, 27, 37, 38, 39, 40]
			@updateFilterBuffer()

	keyDown: (event) ->
		key = event.which
		self = @

		if key == 27
			if @selected.curValue?.value?
				value = @selected.curValue.value
				@setValue undefined
				Meteor.defer =>
					@setValue value
			@opened.set false
			return

		if key isnt 9
			@opened.set true

		if key is 40
			@stop(event)
			@next()
			return

		if key is 38
			@stop(event)
			@prev()
			return

		if key is 13
			@enter()
			return

	updateFilter: ->
		filter = @input.value
		if filter?.trim() isnt ''
			filter = filter.trim()
		else
			filter = undefined

		if not @lookup?
			@filter.set filter
		else
			requestOptions =
				document: @lookup.meta.document._id
				field: @lookup.field.name
				start: 0
				limit: @lookup.limit or 20
				search: filter

			Meteor.call 'data:find:byLookup', requestOptions, (err, result) =>
				if err?
					return console.log err

				items = []
				for item in result.data
					items.push
						label: renderers.lookup item, @lookup.field
						value: item._id
						record: item

				@items.set items

	getFilteredItems: ->
		items = @items.get()
		if not _.isArray items
			return []

		filter = @filter.get()

		if not filter?
			return items

		filteredItems = []
		for item in items
			if @itemMatchFilter item, filter
				filteredItems.push item

		return filteredItems

	itemMatchFilter: (item, filter) ->
		filter = filter.replace /a/i, '[aAÁáÀàÂâÃã]'
		filter = filter.replace /e/i, '[eEÉéÈèÊê]'
		filter = filter.replace /i/i, '[iIÍíÌìÎî]'
		filter = filter.replace /o/i, '[oOÓóÒòÔôÕõ]'
		filter = filter.replace /u/i, '[uUÚúÙùÛûüÜ]'
		filter = filter.replace /c/i, '[cCçÇ]'
		filter = filter.replace /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'

		regex = new RegExp(filter, 'i')
		return regex.test(item.value) or regex.test(item.label)

	setSelected: (value) ->
		items = @items.curValue
		found = false
		for item in items when item.value is value
			found = true
			@selected.set item

		if not found
			@selected.set undefined

		Meteor.defer =>
			if @isRendered()
				@fireEvent 'value-changed'
				@validate()
		return

	select: (value) ->
		@setValue(value)

	getValue: ->
		if @lookup?
			return @selected.get()?.record
		return @selected.get()?.value

	getSelected: ->
		return @selected.get()

	getSelectedLabel: ->
		selected = @selected.get()
		if selected?.label?
			if Match.test selected.label, Object
				return Blaze._globalHelpers.i18n selected.label
			return selected.label
		return

	setItems: (items) ->
		@items.set(items)

	setValue: (value) ->
		if @lookup? and value?._id?
			@items.set [{
				label: renderers.lookup value, @lookup.field
				value: value._id
				record: value
			}]
			@setSelected(value._id)
			return

		@setSelected(value)

	validate: ->
		value = @getValue()
		if not value? and @isRequired.get() is true
			@setValid false, 'field-required'
		else
			@setValid true
