@buildReferences = (Meta) ->
	References = {}

	for metaName, meta of Meta
		for fieldName, field of meta.fields
			if field.type is 'lookup'
				References[field.document] ?= {}
				References[field.document].from ?= {}
				References[field.document].from[metaName] ?= {}
				References[field.document].from[metaName][fieldName] =
					type: field.type
					field: fieldName
					isList: field.isList
					descriptionFields: field.descriptionFields
					detailFields: field.detailFields
					inheritedFields: field.inheritedFields

		if _.isArray meta.relations
			for relation in meta.relations
				References[relation.document] ?= {}
				References[relation.document].relationsFrom ?= {}
				References[relation.document].relationsFrom[metaName] ?= []
				References[relation.document].relationsFrom[metaName].push relation

				References[metaName] ?= {}
				References[metaName].relationsTo ?= {}
				References[metaName].relationsTo[relation.document] ?= []
				References[metaName].relationsTo[relation.document].push relation

	return References