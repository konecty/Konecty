import { isArray, get, has } from 'lodash';
Meteor.methods({
  processLookup(config) {
    let fromDocuments;
    if (!this.userId) {
      return;
    }
    const { documentName, fromDocument, fromField } = config;

    // Get references from meta
    const references = Konsistent.References[documentName];

    // Get model
    const model = Konsistent.Models[documentName];

    const records = model.find().fetch();

    let affectedRecordsCount = 0;

    if (fromDocument) {
      fromDocuments = [fromDocument];
    } else {
      fromDocuments = Object.keys(references.from);
    }

    for (let fromDocumentsItem of fromDocuments) {
      var fromFields;
      if (fromField) {
        fromFields = [fromField];
      } else {
        fromFields = Object.keys(references.from[fromDocumentsItem]);
      }

      console.log(documentName, fromDocumentsItem, fromFields.join(', '));
      for (let record of records) {
        for (let fromFieldsItem of fromFields) {
          const field = references.from[fromDocumentsItem][fromFieldsItem];
          affectedRecordsCount += Konsistent.History.updateLookupReference(
            fromDocumentsItem,
            fromFieldsItem,
            field,
            record,
            documentName
          );
        }
      }
    }

    return records.length;
  },

  processRelation(config) {
    let documentNames;
    if (!this.userId) {
      return;
    }
    const { documentName, fromDocument } = config;

    // Get references from meta
    const references = Konsistent.References[fromDocument];

    // Get model
    const model = Konsistent.Models[fromDocument];

    const records = model.find().fetch();

    let affectedRecordsCount = 0;

    if (documentName) {
      documentNames = [documentName];
    } else {
      documentNames = Object.keys(references.relationsFrom);
    }

    for (let documentNamesItem of documentNames) {
      const relations = references.relationsFrom[documentNamesItem];

      for (let record of records) {
        for (let relation of relations) {
          const lookupIds = [];

          if (has(record, `${relation.lookup}._id`)) {
            lookupIds.push(record[relation.lookup]._id);
          }

          const relationLookupMeta = Meta[relation.document];
          if (get(relationLookupMeta, `fields.${relation.lookup}.isList`) === true && isArray(record[relation.lookup])) {
            for (let value of record[relation.lookup]) {
              if (has(value, '_id')) {
                lookupIds.push(value._id);
              }
            }
          }

          for (let lookupId of lookupIds) {
            affectedRecordsCount += Konsistent.History.updateRelationReference(
              fromDocument,
              relation,
              lookupId,
              'update',
              documentNamesItem
            );
          }
        }
      }
    }

    return records.length;
  }
});
