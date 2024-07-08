
import groupBy from 'lodash/groupBy';
import isArray from 'lodash/isArray';
import merge from 'lodash/merge';
import pick from 'lodash/pick';

import { MetaObject } from '@imports/model/MetaObject';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '@imports/utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';
import { logger } from '@imports/utils/logger';
import { getFieldNamesOfPaths } from '../utils';

async function getDescriptionAndInheritedFieldsToUpdate({ record, metaField, meta }) {
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

        for await (const lookupField of lookupFields) {
            const keysToFind = [].concat(lookupField.descriptionFields || [], lookupField.inheritedFields || []).map(getFieldNamesOfPaths).join();
            const projection = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(keysToFind);

            const Collection = MetaObject.Collections[lookupField.document];
            const lookupRecord = await Collection.findOne({ _id: record[lookupField.name]._id }, { projection });

            const result = await getDescriptionAndInheritedFieldsToUpdate({ record: lookupRecord, metaField: lookupField, meta });
            merge(fieldsToUpdate, result);
        }
    }

    return fieldsToUpdate;
}

export default async function updateLookupReference(metaName, fieldName, field, record, relatedMetaName) {
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
        const updateResult = await collection.updateMany(query, { $set: updateData });

        if (updateResult.modifiedCount > 0) {
            logger.debug(`🔗 ${relatedMetaName} > ${metaName}.${fieldName} (${updateResult.modifiedCount})`);
        }

        return updateResult.modifiedCount;
    } catch (e) {
        logger.error(e, 'Error updating lookup reference');
    }
}