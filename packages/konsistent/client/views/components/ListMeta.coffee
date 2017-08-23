Template.ListMeta.events
	'click .lookup-item': (e, controller) ->
		processingText = 'Processing...'

		target = $(e.currentTarget)
		parent = target.closest('li')

		html = parent.html()

		if html is processingText
			return

		documentName = target.data 'document'
		fromDocument = target.data 'from-document'
		fromField = target.data 'from-field'

		parent.html processingText

		config =
			documentName: documentName
			fromDocument: fromDocument
			fromField: fromField

		Meteor.call 'processLookup', config, (result) ->
			parent.html html

	'click .relation-item': (e, controller) ->
		processingText = 'Processing...'

		target = $(e.currentTarget)
		parent = target.closest('li')

		html = parent.html()

		if html is processingText
			return

		documentName = target.data 'document'
		fromDocument = target.data 'from-document'

		parent.html processingText

		config =
			documentName: documentName
			fromDocument: fromDocument

		Meteor.call 'processRelation', config, (result) ->
			parent.html html
