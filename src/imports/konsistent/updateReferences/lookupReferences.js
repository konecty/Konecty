import BluebirdPromise from 'bluebird';

import intersection from 'lodash/intersection';
import isObject from 'lodash/isObject';
import keys from 'lodash/keys';
import size from 'lodash/size';
import uniq from 'lodash/uniq';

import updateLookupReference from '@imports/konsistent/updateReferences/lookupReference';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

export default async function updateLookupReferences(metaName, id, data, dbSession) {
    // Get references from meta
    const references = MetaObject.References[metaName];

    // Verify if exists reverse relations
    if (!isObject(references) || size(keys(references.from)) === 0) {
        return;
    }

    // Get model
    const collection = MetaObject.Collections[metaName];
    if (collection == null) {
        throw new Error(`Collection ${metaName} not found`);
    }

    // Define object to receive only references that have reference fields in changed data
    const referencesToUpdate = {};

    // Get all keys that was updated
    const updatedKeys = Object.keys(data);

    // Iterate over all relations to verify if each relation have fields in changed keys
    for (var referenceDocumentName in references.from) {
        const fields = references.from[referenceDocumentName];
        for (const fieldName in fields) {
            var key;
            const field = fields[fieldName];
            let keysToUpdate = [];
            // Split each key to get only first key of array of paths
            if (size(field.descriptionFields) > 0) {
                for (key of field.descriptionFields) {
                    keysToUpdate.push(key.split('.')[0]);
                }
            }

            if (size(field.inheritedFields) > 0) {
                for (key of field.inheritedFields) {
                    keysToUpdate.push(key.fieldName.split('.')[0]);
                }
            }

            // Remove duplicated fields, can exists because we splited paths to get only first part
            keysToUpdate = uniq(keysToUpdate);
            // Get only keys that exists in references and list of updated keys
            keysToUpdate = intersection(keysToUpdate, updatedKeys);

            // If there are common fields, add field to list of relations to be processed
            if (keysToUpdate.length > 0) {
                if (!referencesToUpdate[referenceDocumentName]) {
                    referencesToUpdate[referenceDocumentName] = {};
                }
                referencesToUpdate[referenceDocumentName][fieldName] = field;
            }
        }
    }

    // If there are 0 relations to process then abort
    if (Object.keys(referencesToUpdate).length === 0) {
        return;
    }

    // Find record with all information, not only udpated data, to can copy all related fields
    const record = await collection.findOne({ _id: id }, { session: dbSession });

    // If no record was found log error and abort
    if (!record) {
        return logger.error(`Can't find record ${id} from ${metaName}`);
    }

    logger.debug(`Updating references for ${metaName} - ${Object.keys(referencesToUpdate).join(", ")}`);

    // Iterate over relations to process and iterate over each related field to execute a method to update relations
    await BluebirdPromise.map(Object.keys(referencesToUpdate), async referenceDocumentName => {
        const fields = referencesToUpdate[referenceDocumentName];
        await BluebirdPromise.map(Object.keys(fields), async fieldName => {
            const field = fields[fieldName];
            return updateLookupReference(referenceDocumentName, fieldName, field, record, metaName, dbSession);
        }, { concurrency: 5 });
    }, { concurrency: 5 });
}