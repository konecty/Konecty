
import compact from 'lodash/compact';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import merge from 'lodash/merge';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';

import { MetaObject } from '@imports/model/MetaObject';

import { logger } from '../utils/logger';

export default async function updateLookupReference(metaName, fieldName, field, record, relatedMetaName) {
    // Try to get related meta
    const meta = MetaObject.Meta[metaName];
    if (!meta) {
        return logger.error(`MetaObject.Meta ${metaName} does not exists`);
    }

    // Try to get related model
    const collection = MetaObject.Collections[metaName];
    if (collection == null) {
        return logger.error(`Model ${metaName} does not exists`);
    }

    // Define field to query and field to update
    const fieldToQuery = `${fieldName}._id`;
    let fieldToUpdate = fieldName;

    // If field is isList then use .$ into field to update
    // to find in arrays and update only one item from array
    if (field.isList === true) {
        fieldToUpdate = `${fieldName}.$`;
    }

    // Define query with record id
    const query = {};
    query[fieldToQuery] = record._id;

    // Init object of data to set
    const updateData = { $set: {} };

    // Add dynamic field name to update into object to update
    updateData.$set[fieldToUpdate] = {};

    // If there are description fields
    if (isArray(field.descriptionFields) && field.descriptionFields.length > 0) {
        // Execute method to copy fields and values using an array of paths

        const descriptionFieldsValue = pick(record, Array.from(new Set(['_id'].concat(field.descriptionFields))));
        merge(updateData.$set[fieldToUpdate], descriptionFieldsValue);
    }

    // If there are inherit fields
    if (isArray(field.inheritedFields) && field.inheritedFields.length > 0) {
        // For each inherited field
        for (var inheritedField of field.inheritedFields) {
            if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
                // Get field meta
                var inheritedMetaField = meta.fields[inheritedField.fieldName];

                if (inheritedField.inherit === 'hierarchy_always') {
                    if (get(inheritedMetaField, 'type') !== 'lookup' || inheritedMetaField.isList !== true) {
                        logger.error(`Not lookup or not isList field ${inheritedField.fieldName} in ${metaName}`);
                        continue;
                    }
                    if (!record[inheritedField.fieldName]) {
                        record[inheritedField.fieldName] = [];
                    }
                    record[inheritedField.fieldName].push({
                        _id: record._id,
                    });
                }

                // If field is lookup
                if (get(inheritedMetaField, 'type') === 'lookup') {
                    // Get model to find record
                    const lookupCollection = MetaObject.Collections[inheritedMetaField.document];

                    if (!lookupCollection) {
                        logger.error(`Document ${inheritedMetaField.document} not found`);
                        continue;
                    }

                    if (has(record, `${inheritedField.fieldName}._id`) || (inheritedMetaField.isList === true && get(record, `${inheritedField.fieldName}.length`) > 0)) {
                        var lookupRecord, subQuery;
                        if (inheritedMetaField.isList !== true) {
                            subQuery = { _id: record[inheritedField.fieldName]._id.valueOf() };

                            // Find records
                            lookupRecord = await lookupCollection.findOne(subQuery);

                            // If no record found log error
                            if (!lookupRecord) {
                                logger.error(
                                    `Record not found for field ${inheritedField.fieldName} with _id [${subQuery._id}] on document [${inheritedMetaField.document}] not found`,
                                );
                                continue;
                            }

                            // Else copy description fields
                            if (isArray(inheritedMetaField.descriptionFields)) {
                                if (!updateData.$set[inheritedField.fieldName]) {
                                    updateData.$set[inheritedField.fieldName] = {};
                                }

                                const descriptionFieldsValue = pick(lookupRecord, Array.from(new Set(['_id'].concat(inheritedMetaField.descriptionFields))));
                                merge(updateData.$set[inheritedField.fieldName], descriptionFieldsValue);
                            }

                            // End copy inherited values
                            if (isArray(inheritedMetaField.inheritedFields)) {
                                for (let inheritedMetaFieldItem of inheritedMetaField.inheritedFields) {
                                    if (inheritedMetaFieldItem.inherit === 'always') {
                                        updateData.$set[inheritedMetaFieldItem.fieldName] = lookupRecord[inheritedMetaFieldItem.fieldName];
                                    }
                                }
                            }
                        } else if (get(record, `${inheritedField.fieldName}.length`, 0) > 0) {
                            let ids = record[inheritedField.fieldName].map(item => item._id);
                            ids = compact(uniq(ids));
                            subQuery = {
                                _id: {
                                    $in: ids,
                                },
                            };

                            const subOptions = {};
                            if (isArray(inheritedMetaField.descriptionFields)) {
                                subOptions.projection = inheritedMetaField.descriptionFields.reduce((obj, item) => {
                                    const key = item.split('.')[0];
                                    if (obj[key] == null) {
                                        obj[key] = 1;
                                    }
                                    return obj;
                                }, {});
                            }

                            // Find records
                            const lookupRecords = await lookupCollection.find(subQuery, subOptions).toArray();
                            const lookupRecordsById = lookupRecords.reduce((obj, item) => {
                                obj[item._id] = item;
                                return obj;
                            }, {});

                            record[inheritedField.fieldName].forEach(function (item) {
                                lookupRecord = lookupRecordsById[item._id];

                                // If no record found log error
                                if (!lookupRecord) {
                                    logger.error(
                                        `Record not found for field ${inheritedField.fieldName} with _id [${item._id}] on document [${inheritedMetaField.document}] not found`,
                                    );
                                    return;
                                }

                                // Else copy description fields
                                if (isArray(inheritedMetaField.descriptionFields)) {
                                    const tempValue = pick(lookupRecord, Array.from(new Set(['_id'].concat(inheritedMetaField.descriptionFields))));
                                    if (updateData.$set[inheritedField.fieldName] == null) {
                                        updateData.$set[inheritedField.fieldName] = [];
                                    }
                                    return updateData.$set[inheritedField.fieldName].push(tempValue);
                                }
                            });
                        }
                    }
                } else {
                    // Copy data into object to update if inherit method is 'always'
                    updateData.$set[inheritedField.fieldName] = record[inheritedField.fieldName];
                }
            }
        }
    }

    try {
        // Execute update and get affected records
        const updateResult = await collection.updateMany(query, updateData);

        // If there are affected records then log
        if (updateResult.modifiedCount > 0) {
            logger.debug(`🔗 ${relatedMetaName} > ${metaName}.${fieldName} (${updateResult.modifiedCount})`);
        }

        return updateResult.modifiedCount;
    } catch (e) {
        logger.error(e, 'Error updating lookup reference');
    }
}