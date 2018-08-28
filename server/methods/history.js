/* List history for a record
	@param authTokenId
	@param document
	@param dataId
	@param fields
*/
import { has } from 'lodash';
Meteor.registerMethod('history:find', 'withUser', 'withAccessForDocument', function(request) {
  // Verify if user have permission to read records
  let value;
  if (this.access.isReadable !== true) {
    return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read records`);
  }

  const historyModel = Models[`${request.document}.History`];

  const metaObject = Meta[request.document];

  const query = { dataId: request.dataId };

  const fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(request.fields);

  // Validate if user have permission to view each field
  const emptyFields = Object.keys(fields).length === 0;
  for (let fieldName in metaObject.fields) {
    const accessField = accessUtils.getFieldPermissions(this.access, fieldName);
    const accessFieldConditions = accessUtils.getFieldConditions(this.access, fieldName);
    if (accessField.isReadable !== true || has(accessFieldConditions, 'READ')) {
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
    sort: {
      createdAt: 1
    }
  };

  const records = historyModel.find(query, options).fetch();

  for (let record of records) {
    if (!record.diffs && record.data) {
      record.diffs = {};
      for (field in record.data) {
        value = record.data[field];
        record.diffs[field] = {};
        record.diffs[field][record.type === 'delete' ? 'from' : 'to'] = value;
      }

      delete record.data;
    }
  }

  return { data: records };
});
