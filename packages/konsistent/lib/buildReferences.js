buildReferences = function(Meta) {
  const References = {};

  for (let metaName in Meta) {
    const meta = Meta[metaName];
    for (let fieldName in meta.fields) {
      const field = meta.fields[fieldName];
      if (field.type === 'lookup') {
        if (!References[field.document]) {
          References[field.document] = {};
        }
        if (!References[field.document].from) {
          References[field.document].from = {};
        }
        if (!References[field.document].from[metaName]) {
          References[field.document].from[metaName] = {};
        }
        References[field.document].from[metaName][fieldName] = {
          type: field.type,
          field: fieldName,
          isList: field.isList,
          descriptionFields: field.descriptionFields,
          detailFields: field.detailFields,
          inheritedFields: field.inheritedFields
        };
      }
    }

    if (_.isArray(meta.relations)) {
      for (let relation of meta.relations) {
        if (!References[relation.document]) {
          References[relation.document] = {};
        }
        if (!References[relation.document].relationsFrom) {
          References[relation.document].relationsFrom = {};
        }
        if (!References[relation.document].relationsFrom[metaName]) {
          References[relation.document].relationsFrom[metaName] = [];
        }
        References[relation.document].relationsFrom[metaName].push(relation);

        if (!References[metaName]) {
          References[metaName] = {};
        }
        if (!References[metaName].relationsTo) {
          References[metaName].relationsTo = {};
        }
        if (!References[metaName].relationsTo[relation.document]) {
          References[metaName].relationsTo[relation.document] = [];
        }
        References[metaName].relationsTo[relation.document].push(relation);
      }
    }
  }

  return References;
};
