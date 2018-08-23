/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/* List history for a record
	@param authTokenId
	@param document
	@param dataId
	@param fields
*/
Meteor.registerMethod('history:find', 'withUser', 'withAccessForDocument', function(request) {
	// Verify if user have permission to read records
	let value;
	if (this.access.isReadable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read records`);
	}

	const historyModel = Models[`${request.document}.History`];

	const metaObject = Meta[request.document];

	const query =
		{dataId: request.dataId};

	const fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(request.fields);

	// Validate if user have permission to view each field
	const emptyFields = Object.keys(fields).length === 0;
	for (let fieldName in metaObject.fields) {
		const accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		const accessFieldConditions = accessUtils.getFieldConditions(this.access, fieldName);
		if ((accessField.isReadable !== true) || ((accessFieldConditions != null ? accessFieldConditions.READ : undefined) != null)) {
			if (emptyFields === true) {
				fields[fieldName] = 0;
			} else {
				delete fields[fieldName];
			}
		}
	}

	const convertedFields = {};
	for (var field in fields) {
		value = fields[field];
		convertedFields[`data.${field}`] = value;
		convertedFields[`diffs.${field}`] = value;
	}

	const options = {
		fields: convertedFields,
		sort: { createdAt: 1
	}
	};

	const records = historyModel.find(query, options).fetch();

	for (let record of Array.from(records)) {
		if ((record.diffs == null) && (record.data != null)) {
			record.diffs = {};
			for (field in record.data) {
				value = record.data[field];
				record.diffs[field] = {};
				record.diffs[field][record.type === 'delete' ? 'from' : 'to'] = value;
			}

			delete record.data;
		}
	}

	return {data: records};
});
