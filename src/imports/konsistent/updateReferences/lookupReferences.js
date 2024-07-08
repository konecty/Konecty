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
export default async function updateLookupReferences(metaName, id, data, dbSession) {
    const references = MetaObject.References[metaName];

    if (!isObject(references) || size(keys(references.from)) === 0) {
        logger.debug(`No references from ${metaName}`);
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

            // Remove duplicated fields & get only fields that were updated
            keysToUpdate = uniq(keysToUpdate);
            keysToUpdate = intersection(keysToUpdate, updatedKeys);

            if (keysToUpdate.length > 0) {
                if (!referencesToUpdate[referenceDocumentName]) {
                    referencesToUpdate[referenceDocumentName] = {};
                }
                referencesToUpdate[referenceDocumentName][fieldName] = field;
            }
        }
    }

    if (Object.keys(referencesToUpdate).length === 0) {
        logger.debug(`No references to update for ${metaName}`);
        return;
    }

    if (Array.isArray(id) && id.length > 1) {
        const records = await collection.find({ _id: { $in: id } }, { session: dbSession }).toArray();
        return await Promise.all(records.map(record => processReferences({ referencesToUpdate, metaName, record, dbSession })));
    }

    const record = await collection.findOne({ _id: [].concat(id)[0] }, { session: dbSession });
    if (!record) {
        return logger.error(`Can't find record ${id} from ${metaName}`);
    }

    logger.debug(`Updating references for ${metaName} - ${Object.keys(referencesToUpdate).join(", ")}`);
    return await processReferences({ referencesToUpdate, metaName, record, dbSession });
}
const processReferences = async ({ referencesToUpdate, metaName, record, dbSession }) => {
    return await BluebirdPromise.map(Object.keys(referencesToUpdate), async referenceDocumentName => {
        const fields = referencesToUpdate[referenceDocumentName];
        await BluebirdPromise.map(Object.keys(fields), async fieldName => {
            const field = fields[fieldName];
            return updateLookupReference(referenceDocumentName, fieldName, field, record, metaName, dbSession);
        }, { concurrency: 5 });
    }, { concurrency: 5 });
}