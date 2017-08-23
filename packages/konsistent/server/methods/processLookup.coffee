Meteor.methods
	processLookup: (config) ->
		if not @userId? then return
		{documentName, fromDocument, fromField} = config

		# Get references from meta
		references = Konsistent.References[documentName]

		# Get model
		model = Konsistent.Models[documentName]

		records = model.find().fetch()

		affectedRecordsCount = 0

		if fromDocument?
			fromDocuments = [fromDocument]
		else
			fromDocuments = Object.keys references.from

		for fromDocumentsItem in fromDocuments
			if fromField?
				fromFields = [fromField]
			else
				fromFields = Object.keys references.from[fromDocumentsItem]

			console.log documentName, fromDocumentsItem, fromFields.join ', '
			for record in records
				for fromFieldsItem in fromFields
					field = references.from[fromDocumentsItem][fromFieldsItem]
					affectedRecordsCount += Konsistent.History.updateLookupReference fromDocumentsItem, fromFieldsItem, field, record, documentName

		return records.length

	processRelation: (config) ->
		if not @userId? then return
		{documentName, fromDocument} = config

		# Get references from meta
		references = Konsistent.References[fromDocument]

		# Get model
		model = Konsistent.Models[fromDocument]

		records = model.find().fetch()

		affectedRecordsCount = 0

		if documentName?
			documentNames = [documentName]
		else
			documentNames = Object.keys references.relationsFrom

		for documentNamesItem in documentNames
			relations = references.relationsFrom[documentNamesItem]

			for record in records
				for relation in relations
					lookupIds = []

					if record[relation.lookup]?._id?
						lookupIds.push record[relation.lookup]._id

					relationLookupMeta = Meta[relation.document]
					if relationLookupMeta.fields[relation.lookup]?.isList is true and _.isArray(record[relation.lookup])
						for value in record[relation.lookup]
							if value?._id?
								lookupIds.push value._id

					for lookupId in lookupIds
						affectedRecordsCount += Konsistent.History.updateRelationReference fromDocument, relation, lookupId, 'update', documentNamesItem

		return records.length

