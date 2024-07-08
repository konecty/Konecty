import BluebirdPromise from 'bluebird';

import intersection from 'lodash/intersection';
import isObject from 'lodash/isObject';
import keys from 'lodash/keys';
import size from 'lodash/size';
import uniq from 'lodash/uniq';

import updateLookupReference from '@imports/konsistent/updateReferences/lookupReference';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { getFieldNamesOfPaths } from '../utils';

/**
 * When some document changes, verify if it's a lookup in some other document.
 * If it is, update description & inherited fields in all related documents.
 * @param {string} metaName 
 * @param {string} id 
 * @param {object} data 
 * @returns {Promise<void>}
 */
export default async function updateLookupReferences(metaName, id, data) {
    const references = MetaObject.References[metaName];

    if (!isObject(references) || size(keys(references.from)) === 0) {
        return;
    }

    const collection = MetaObject.Collections[metaName];
    if (collection == null) {
        throw new Error(`Collection ${metaName} not found`);
    }

    const referencesToUpdate = {};
    const updatedKeys = Object.keys(data);

    // Iterate over all relations to verify if each relation have fields in changed keys
    for (var referenceDocumentName in references.from) {
        const fields = references.from[referenceDocumentName];
        for (const fieldName in fields) {
            const field = fields[fieldName];
            let keysToUpdate = [].concat(field.descriptionFields || [], field.inheritedFields || []).map(getFieldNamesOfPaths);

            // Remove duplicated fields
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

    if (Object.keys(referencesToUpdate).length === 0) {
        return;
    }

    const record = await collection.findOne({ _id: id });

    if (!record) {
        return logger.error(`Can't find record ${id} from ${metaName}`);
    }

    logger.debug(`Updating references for ${metaName} - ${Object.keys(referencesToUpdate).join(", ")}`);

    await BluebirdPromise.mapSeries(Object.keys(referencesToUpdate), async referenceDocumentName => {
        const fields = referencesToUpdate[referenceDocumentName];
        await BluebirdPromise.mapSeries(Object.keys(fields), async fieldName => {
            const field = fields[fieldName];
            return updateLookupReference(referenceDocumentName, fieldName, field, record, metaName);
        });
    });
}
