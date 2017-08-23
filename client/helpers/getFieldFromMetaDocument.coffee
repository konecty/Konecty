UI.registerHelper 'getFieldFromMetaDocument', (metaDocument, fieldName) ->
	return metaDocument.fields[fieldName]