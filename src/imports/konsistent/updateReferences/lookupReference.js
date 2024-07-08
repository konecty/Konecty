
import groupBy from 'lodash/groupBy';
import isArray from 'lodash/isArray';
import merge from 'lodash/merge';
import mergeWith from 'lodash/mergeWith';
import pick from 'lodash/pick';

import { MetaObject } from '@imports/model/MetaObject';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '@imports/utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';
import { logger } from '@imports/utils/logger';
import { getFieldNamesOfPaths } from '../utils';
import updateLookupReferences from './lookupReferences';

async function getDescriptionAndInheritedFieldsToUpdate({ record, metaField, meta, dbSession }) {
    const fieldsToUpdate = {}

    if (isArray(metaField.descriptionFields) && metaField.descriptionFields.length > 0) {
        const updateKey = metaField.isList ? `${metaField.name}.$` : `${metaField.name}`;
        const descriptionFieldsValue = pick(record, Array.from(new Set(['_id'].concat(metaField.descriptionFields))));

        fieldsToUpdate[updateKey] = descriptionFieldsValue;
    }

    if (isArray(metaField.inheritedFields) && metaField.inheritedFields.length > 0) {
        const inheritedFields = metaField.inheritedFields.filter(inheritedField => ['always', 'hierarchy_always'].includes(inheritedField.inherit));
        const fieldsToInherit = inheritedFields.map(inheritedField => meta.fields[inheritedField.fieldName]).filter(Boolean);

        const { true: lookupFields = [], false: nonLookupFields = [] } = groupBy(fieldsToInherit, field => field.type === 'lookup');

        for (const field of nonLookupFields) {
            fieldsToUpdate[field.name] = record[field.name];
        }

        // For inherited lookup fields we need to inherit recursively and merge all results
        for await (const lookupField of lookupFields) {
            const keysToFind = [].concat(lookupField.descriptionFields || [], lookupField.inheritedFields || []).map(getFieldNamesOfPaths).join();
            const projection = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(keysToFind);

            const Collection = MetaObject.Collections[lookupField.document];
            const lookupRecord = await Collection.find({ _id: { $in: [].concat(record[lookupField.name]).map(v => v._id) } }, { projection, session: dbSession }).toArray();

            for await (const lookupRec of lookupRecord) {
                const result = await getDescriptionAndInheritedFieldsToUpdate({ record: lookupRec, metaField: lookupField, meta, dbSession });
                if (lookupField.isList) {
                    mergeWith(fieldsToUpdate, result, (objValue = [], srcValue = [], key) => /\$$/.test(key) ? [].concat(objValue, srcValue) : undefined);
                } else {
                    merge(fieldsToUpdate, result);
                }
            }

            if (fieldsToUpdate[`${lookupField.name}.$`]) {
                fieldsToUpdate[lookupField.name] = fieldsToUpdate[`${lookupField.name}.$`];
                delete fieldsToUpdate[`${lookupField.name}.$`];
            }
        }
    }

    return fieldsToUpdate;
}

export default async function updateLookupReference(metaName, fieldName, field, record, relatedMetaName, dbSession) {
    if (dbSession?.hasEnded) {
        return;
    }

    const meta = MetaObject.Meta[metaName];
    if (!meta) {
        return logger.error(`MetaObject.Meta ${metaName} does not exists`);
    }

    const collection = MetaObject.Collections[metaName];
    if (collection == null) {
        return logger.error(`Model ${metaName} does not exists`);
    }

    try {
        const updateData = await getDescriptionAndInheritedFieldsToUpdate({ record, metaField: field, meta });
        if (Object.keys(updateData).length === 0) {
            return;
        }

        const query = { [`${fieldName}._id`]: record._id };
        const updateResult = await collection.updateMany(query, { $set: updateData }, { session: dbSession });

        if (updateResult.modifiedCount > 0) {
            logger.debug(`🔗 ${relatedMetaName} > ${metaName}.${fieldName} (${updateResult.modifiedCount})`);
            const projection = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(Object.keys(updateData).join());

            const modified = await collection.find(query, { projection }).toArray();
            await Promise.all(modified.map(async (modifiedRecord) =>
                updateLookupReferences(metaName, modifiedRecord._id, modifiedRecord, dbSession)
            ));
        }

        return updateResult.modifiedCount;
    } catch (e) {
        logger.error(e, 'Error updating lookup reference');
        logger.error({ metaName, fieldName, field, relatedMetaName })
    }
}