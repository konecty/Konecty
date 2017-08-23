lookupUtils = {}

lookupUtils.copyDescriptionAndInheritedFields = (lookupField, lookupValue, lookupRecord, meta, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate) ->
	# Remove all values from object to prevent unwanted values
	for key of lookupValue
		if key isnt '_id'
			delete lookupValue[key]

	lookupValue._id = lookupRecord._id

	if _.isArray lookupField.descriptionFields
		utils.copyObjectFieldsByPathsIncludingIds lookupRecord, lookupValue, lookupField.descriptionFields

	if _.isArray lookupField.inheritedFields
		for inheritedField in lookupField.inheritedFields
			if inheritedField.inherit in ['always', 'hierarchy_always', 'once_readonly']
				if inheritedField.inherit is 'hierarchy_always'
					lookupRecord[inheritedField.fieldName] ?= []
					lookupRecord[inheritedField.fieldName].push
						_id: lookupRecord._id

				validation = metaUtils.validateAndProcessValueFor meta, inheritedField.fieldName, lookupRecord[inheritedField.fieldName], actionType, model, objectOriginalValues, objectNewValues, idsToUpdate
				if validation is undefined
					validation = null
				if validation instanceof Error
					return validation
				objectNewValues[inheritedField.fieldName] = validation

			else #until_edited, once_editable

				if not objectOriginalValues[inheritedField.fieldName]?
					validation = metaUtils.validateAndProcessValueFor meta, inheritedField.fieldName, lookupRecord[inheritedField.fieldName], actionType, model, objectOriginalValues, objectNewValues, idsToUpdate
					if validation instanceof Error
						return validation
					objectNewValues[inheritedField.fieldName] = validation


lookupUtils.removeInheritedFields = (lookupField, objectNewValues) ->
	if _.isArray lookupField.inheritedFields
		for inheritedField in lookupField.inheritedFields
			if inheritedField.inherit in ['always', 'hierarchy_always']
				objectNewValues[inheritedField.fieldName] = null
