class @Component.form extends KonectyComponent
	@register 'Component.form'

	onCreated: ->
		this.state = new ReactiveVar 'view' # can be view, edit or insert
		this.errors = new ReactiveVar undefined
		this.dirty = new ReactiveVar false
		this.dirtyFields = new ReactiveVar {}

		# Tracker.autorun =>
		# 	dirtyFields = this.dirtyFields.get()
		# 	if Object.keys(dirtyFields).length
		# 		if this.state.curValue is 'view'
		# 			this.state.set('edit')


	record: ->
		return Session.get 'CurrentRecord'

	getIconChar: (label) ->
		Blaze._globalHelpers.i18n(label)[0].toUpperCase()

	tokenize: (token) ->
		return token?.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9]/g, '');

	canInsert: ->
		return not @errors.get()? and @dirty.get() is false

	canSave: ->
		# return @state.get() in ['insert', 'edit']
		return not @errors.get()? and @dirty.get() is true

	canCancel: ->
		return @dirty.get() is true

	events: -> [
		"click .control": (e) ->
			e.preventDefault()
			e.stopPropagation()
			Layout.view.toggle()

		"click .alert-a": (e) ->
			Alert.alert
				title: "Ops!"
				message: "You can't do this."
				actionText: "Ok"
				onAction:
					callback: ->
						console.log "CALLBACK"

		"click .alert-b": (e) ->
			Alert.set("alertPrompt")
			Alert.prompt
				title: "Hi!"
				message: "What was the color of Napoleon's white horse?"
				onAction:
					waitOn: (params, next) ->
						res = if params.value?.match(/^white$/i) then true else false
						next res
					success:
						title: "Congratulations!"
						message: "You are awesome."
					fail:
						title: "Really?!"
						message: "No, this isn't the horse's color."
				onCancel: {}

		"click .alert-c": (e) ->
			Alert.confirm
				title: "Delete File"
				message: "Are you sure you want to delete this file?"
				actionText: "Yes"
				cancelText: "No"
				onAction:
					waitOn: (params, next) ->
						setTimeout ->
							next true
						,500
					success:
						title: "Success!"
						message: "Your file is now on your trash folder."
					fail:
						title: "Error!"
						message: "This is a error message"
				onCancel: {}

		"click a[group-name]": (e) ->
			groupName = $(e.currentTarget).attr('group-name')
			template = Template.instance()
			position = template.$("li[group-name=#{groupName}]").position()
			scrollTop = template.$('.wrapper').scrollTop()
			template.find('.wrapper').scrollTop = position.top + scrollTop

		"click konecty-button[icon=times]": (e) ->
			template = Template.instance()

			if template.state.get() is 'edit'
				dirtyFields = template.dirtyFields.curValue
				for fieldName, value of dirtyFields
					template.find("[name=#{fieldName}]").reset?()

			else if template.state.get() is 'insert'
				Session.set('CurrentRecord', undefined)

			Template.instance().state.set 'view'

		"click .new-record": (e) ->
			record = {}
			for name, field of this.data().meta.document.fields
				if field.defaultValue?
					record[name] = field.defaultValue

			for visual in this.data().meta.view.visuals
				if visual.defaultValue?
					record[visual.name] = visual.defaultValue

			Session.set('CurrentRecord', record)
			Grid.cleanCurrent()
			this.state.set 'insert'

		"click .cp-button.save": (e) ->
			self = this

			value = {}

			for child in @componentChildren()
				if child instanceof KonectyFieldComponent
					if child.isDirty?
						if child.isDirty()
							value[child.getName()] = child.getValue()
					else
						console.log child.componentName(), 'has no method isDirty'
						value[child.getName()] = child.getValue()

			for k, v of value
				if v is undefined
					value[k] = null

			console.log JSON.stringify value, null, '  '

			if Object.keys(value).length > 0
				record = Session.get 'CurrentRecord'
				update =
					document: this.data().meta.document._id
					data:
						ids: [{
							_id: record._id
							_updatedAt:
								$date: record._updatedAt.toISOString()
						}]
						data: value

				Meteor.call 'data:update', update, (err, result) =>
					if result?.errors?
						console.log JSON.stringify result.errors
						return

					Session.set 'CurrentRecord', Models[this.data().meta.document._id].findOne record._id
					this.state.set 'view'

		'value-changed .field > .component': (e) ->
			errors = []
			dirty = false

			for child in @componentChildren()
				if child instanceof KonectyFieldComponent
					if child.isValid() isnt true
						errors.push
							field: child.getName()
							message: child.isValid()

					if child.isDirty()
						dirty = true

			if errors.length is 0
				@errors.set undefined
			else
				@errors.set errors

			@dirty.set dirty

		"dirty [konecty-field]": (e) ->
			field = e.currentTarget
			template = Template.instance()
			dirtyFields = template.dirtyFields.get()

			dirtyFields[field.name] = true

			template.dirtyFields.set(dirtyFields)

		"undirty [konecty-field]": (e) ->
			field = e.currentTarget
			template = Template.instance()
			dirtyFields = template.dirtyFields.get()

			delete dirtyFields[field.name]

			template.dirtyFields.set(dirtyFields)
	]
