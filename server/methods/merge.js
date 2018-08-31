/* Simualte merge
	@TODO: Permissões?

	@param authTokenId
	@param document
	@param ids
	@param targetId
*/
Meteor.registerMethod(
  'merge:simulate',
  'withUser',
  'withAccessForDocument',
  'withMetaForDocument',
  'withModelForDocument',
  function(request) {
    const context = this;
    const { access, meta, model } = this;

    // Initial validations
    if (!Match.test(request.ids, [String])) {
      return new Meteor.Error('internal-error', 'A propriedade [ids] deve ser um array de strings', { request });
    }

    if (request.ids.length === 0) {
      return new Meteor.Error('internal-error', 'Deve ser informado ao menos um id', { request });
    }

    if (!Match.test(request.targetId, String)) {
      return new Meteor.Error('internal-error', 'A propriedade [targetId] deve ser uma string', { request });
    }

    if (request.ids.indexOf(request.targetId) === -1) {
      return new Meteor.Error(
        'internal-error',
        'A propriedade [targetId] deve ser um dos valores informados na propriedade [ids]',
        { request }
      );
    }

    // Find data
    const query = {
      _id: {
        $in: request.ids
      }
    };

    const records = model.find(query).fetch();

    if (records.length !== request.ids.length) {
      const foundIds = records.map(record => record._id);
      return new Meteor.Error(
        'internal-error',
        `Foram encontrados apenas os ids [${foundIds.join(', ')}] para os ids passados [${request.ids.join(', ')}]`
      );
    }

    const merged = {};
    const conflicts = {};

    const removeDuplicatedValues = function(values, directValues) {
      const result = [];
      for (let index1 = 0; index1 < values.length; index1++) {
        const value1 = values[index1];
        let equals = false;
        for (
          let start = index1 + 1, index2 = start, end = values.length, asc = start <= end;
          asc ? index2 < end : index2 > end;
          asc ? index2++ : index2--
        ) {
          const value2 = values[index2];
          if (directValues === true) {
            if (utils.deepEqual(value1, value2)) {
              equals = true;
              break;
            }
          } else {
            if (utils.deepEqual(value1.value, value2.value)) {
              equals = true;
              break;
            }
          }
        }

        if (equals === false) {
          result.push(value1);
        }
      }

      return result;
    };

    const processIsListField = function(values) {
      const result = {
        _id: [],
        value: []
      };

      for (let value of values) {
        if (Match.test(value.value, Array) && value.value.length > 0) {
          result.value = result.value.concat(value.value);
          result._id.push(value._id);
        }
      }

      result.value = removeDuplicatedValues(result.value, true);

      return [result];
    };

    const processField = function(field) {
      let values = [];
      for (let record of records) {
        if (record[field.name]) {
          values.push({
            _id: record._id,
            value: record[field.name]
          });
        }
      }

      if (field.isList !== true) {
        values = removeDuplicatedValues(values);
      }

      if (values.length === 1) {
        merged[field.name] = values[0].value;
      }

      if (values.length > 1) {
        if (field.isList === true) {
          values = processIsListField(values);
          merged[field.name] = values[0].value;
        } else {
          if (_.isArray(values[0].value) && _.difference(values[0].value, values[1].value).length === 0) {
            merged[field.name] = values[0].value;
          } else if (_.isEqual(values[0].value, values[1].value)) {
            merged[field.name] = values[0].value;
          } else {
            conflicts[field.name] = values;
          }
        }
      }
    };

    const excludedTypes = ['autoNumber'];
    const excludedNames = ['_updatedAt', '_createdAt'];

    for (let fieldName in meta.fields) {
      const field = meta.fields[fieldName];
      if (!excludedTypes.includes(field.type) && !excludedNames.includes(field.name)) {
        processField(field);
      }
    }

    return {
      merged,
      conflicts
    };
  }
);

/* Execute merge
	@TODO: Permissões?

	@param authTokenId
	@param document
	@param ids
	@param targetId
	@param data
*/
Meteor.registerMethod('merge:save', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', function(
  request
) {
  let data;
  const context = this;
  let { access, meta, model } = this;

  // Initial validations
  if (!Match.test(request.ids, [String])) {
    return new Meteor.Error('internal-error', 'A propriedade [ids] deve ser um array de strings', { request });
  }

  if (request.ids.length === 0) {
    return new Meteor.Error('internal-error', 'Deve ser informado ao menos um id', { request });
  }

  if (!Match.test(request.targetId, String)) {
    return new Meteor.Error('internal-error', 'A propriedade [targetId] deve ser uma string', { request });
  }

  if (!Match.test(request.data, Object)) {
    return new Meteor.Error('internal-error', 'A propriedade [data] deve ser um objeto contendo valores', { request });
  }

  request.ids = _.without(request.ids, request.targetId);

  // Find data
  let query = {
    _id: {
      $in: request.ids
    }
  };

  const records = model.find(query).fetch();

  if (records.length !== request.ids.length) {
    const foundIds = records.map(record => record._id);
    return new Meteor.Error(
      'internal-error',
      `Foram encontrados apenas os ids [${foundIds.join(', ')}] para os ids passados [${request.ids.join(', ')}]`
    );
  }

  // Find target id
  query = { _id: request.targetId };

  const targetRecord = model.findOne(query);

  // Remove unmodified values
  for (let field in targetRecord) {
    const value = targetRecord[field];
    if (field !== '_merge' && utils.deepEqual(value, request.data[field])) {
      delete request.data[field];
    }
  }

  // Add merge ids into record
  if (!request.data._merge) {
    request.data._merge = [];
  }
  request.data._merge = request.data._merge.concat(request.ids);
  request.data._merge = _.uniq(request.data._merge);

  let update = {
    ids: [
      {
        _id: targetRecord._id,
        _updatedAt: {
          $date: targetRecord._updatedAt.toISOString()
        }
      }
    ],
    data: request.data
  };

  // Exec update
  const updateResult = Meteor.call('data:update', {
    data: update,
    document: request.document,
    __scope__: {
      user: this.user,
      access: this.access
    }
  });

  if (has(updateResult, 'data.0')) {
    return updateResult;
  }

  // Get history Model
  const historyModel = Models[`${request.document}.History`];

  // Define ids to delete
  const del = { ids: [] };

  // Get ids to delete and generate merge histories
  for (let record of records) {
    del.ids.push({
      _id: record._id,
      _updatedAt: {
        $date: record._updatedAt.toISOString()
      }
    });

    query = { _id: Date.now() * 100 };

    data = {
      _id: query._id,
      dataId: record._id,
      mergeTargetId: request.targetId,
      type: 'merge',
      createdAt: new Date(),
      createdBy: {
        _id: this.user._id,
        name: this.user.name,
        group: this.user.group
      },
      data: record
    };

    historyModel.upsert(query, data);

    // update old histories to reference the new merged document
		historyModel.update({ dataId: record._id, origDataId: { $exists: false } }, { $set: { origDataId: record._id } }, { multi: true });
		historyModel.update({ dataId: record._id }, { $set: { dataId: request.targetId } }, { multi: true });
  }

  for (let referenceDocumentName in get(References[request.document], 'from')) {
    const referenceFields = get(References[request.document], `from.${referenceDocumentName}`);
    for (let referenceFieldName in referenceFields) {
      const referenceField = referenceFields[referenceFieldName];
      update = {
        ids: [
          {
            _id: targetRecord._id,
            _updatedAt: {
              $date: targetRecord._updatedAt.toISOString()
            }
          }
        ],
        data: request.data
      };

      query = {};
      query[`${referenceFieldName}._id`] = { $in: request.ids };

      update = {
        _updatedAt: new Date(),
        _updatedBy: {
          _id: this.user._id,
          name: this.user.name,
          group: this.user.group
        },
        _merge: request.data._merge
      };

      update[referenceFieldName] = { _id: updateResult.data[0]._id };

      if (_.isArray(referenceField.descriptionFields)) {
        utils.copyObjectFieldsByPathsIncludingIds(
          updateResult.data[0],
          update[referenceFieldName],
          referenceField.descriptionFields
        );
      }

      if (referenceField.isList === true) {
        update[`${referenceFieldName}.$`] = update[referenceFieldName];
        delete update[referenceFieldName];
      }

			update =
				{$set: update};

			const options =
				{multi: true};

      model = Models[referenceDocumentName];
			model.update(query, update, options);
    }
  }

  // Exec deletions
  Meteor.call('data:delete', {
    data: del,
    document: request.document,
    __scope__: {
      user: this.user,
      access: this.access
    }
  });

  return updateResult;
});
