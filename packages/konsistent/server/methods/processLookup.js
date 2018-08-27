/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// import Konsistent from '../imports';

Meteor.methods({
  processLookup(config) {
    let fromDocuments;
    if (this.userId == null) {
      return;
    }
    const { documentName, fromDocument, fromField } = config;

    // Get references from meta
    const references = Konsistent.References[documentName];

    // Get model
    const model = Konsistent.Models[documentName];

    const records = model.find().fetch();

    let affectedRecordsCount = 0;

    if (fromDocument != null) {
      fromDocuments = [fromDocument];
    } else {
      fromDocuments = Object.keys(references.from);
    }

    for (let fromDocumentsItem of fromDocuments) {
      var fromFields;
      if (fromField != null) {
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
    if (this.userId == null) {
      return;
    }
    const { documentName, fromDocument } = config;

    // Get references from meta
    const references = Konsistent.References[fromDocument];

    // Get model
    const model = Konsistent.Models[fromDocument];

    const records = model.find().fetch();

    let affectedRecordsCount = 0;

    if (documentName != null) {
      documentNames = [documentName];
    } else {
      documentNames = Object.keys(references.relationsFrom);
    }

    for (let documentNamesItem of documentNames) {
      const relations = references.relationsFrom[documentNamesItem];

      for (let record of records) {
        for (let relation of relations) {
          const lookupIds = [];

          if ((record[relation.lookup] != null ? record[relation.lookup]._id : undefined) != null) {
            lookupIds.push(record[relation.lookup]._id);
          }

          const relationLookupMeta = Meta[relation.document];
          if (
            (relationLookupMeta.fields[relation.lookup] != null ? relationLookupMeta.fields[relation.lookup].isList : undefined) ===
              true &&
            _.isArray(record[relation.lookup])
          ) {
            for (let value of record[relation.lookup]) {
              if ((value != null ? value._id : undefined) != null) {
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
