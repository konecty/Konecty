import BluebirdPromise from 'bluebird';

import { copyDescriptionAndInheritedFields } from '@imports/meta/copyDescriptionAndInheritedFields';
import { logger } from '@imports/utils/logger';

import { MetaObject } from '@imports/model/MetaObject';

export default async function processReverseLookups(metaName, id, data, action, dbSession) {
    let field;
    if (action === 'delete') {
        return;
    }

    const meta = MetaObject.Meta[metaName];
    const collection = MetaObject.Collections[metaName];

    let reverseLookupCount = 0;
    for (var fieldName in meta.fields) {
        field = meta.fields[fieldName];
        if (field.type === 'lookup' && !field.reverseLookup && data[field.name] !== undefined) {
            reverseLookupCount++;
        }
    }

    if (reverseLookupCount === 0) {
        return;
    }

    // Get all data to copty into lookups
    const query = { _id: id };

    const record = await collection.findOne(query, { session: dbSession });

    if (!record) {
        return logger.error(`Record not found with _id [${id.valueOf()}] on document [${metaName}]`);
    }

    // Process reverse lookups
    await BluebirdPromise.mapSeries(Object.keys(meta.fields), async fieldName => {
        field = meta.fields[fieldName];
        if (field.type === 'lookup' && field.reverseLookup) {
            let reverseLookupQuery, reverseLookupUpdate;

            const reverseLookupMeta = MetaObject.Meta[field.document];

            if (reverseLookupMeta == null) {
                logger.error(`MetaObject.Meta [${field.document}] not found`);
                return;
            }

            if (reverseLookupMeta.fields[field.reverseLookup] == null) {
                logger.error(`Field [${field.reverseLookup}] does not exists in [${field.document}]`);
                return;
            }

            const reverseLookupCollection = MetaObject.Collections[field.document];

            // Mount query and update to remove reverse lookup from another records
            if (data[field.name] !== undefined) {
                reverseLookupQuery = {};

                if (data[field.name]) {
                    reverseLookupQuery._id = { $ne: data[field.name]._id };
                }

                reverseLookupQuery[`${field.reverseLookup}._id`] = id;

                reverseLookupUpdate = { $unset: {} };
                reverseLookupUpdate.$unset[field.reverseLookup] = 1;

                if (reverseLookupMeta.fields[field.reverseLookup].isList === true) {
                    delete reverseLookupUpdate.$unset;
                    reverseLookupUpdate.$pull = {};
                    reverseLookupUpdate.$pull[`${field.reverseLookup}`] = { _id: id };
                }

                const updateResult = await reverseLookupCollection.updateMany(reverseLookupQuery, reverseLookupUpdate, { session: dbSession });

                if (updateResult.modifiedCount > 0) {
                    logger.info(`∞ ${field.document}.${field.reverseLookup} - ${metaName} (${updateResult.modifiedCount})`);
                }
            }

            // Create fake empty record to be populated with lookup detail fields and inherited fields
            if (data[field.name]) {
                const value = {};
                value[field.reverseLookup] = { _id: id };

                await copyDescriptionAndInheritedFields({
                    field: reverseLookupMeta.fields[field.reverseLookup],
                    record: record,
                    meta: reverseLookupMeta,
                    actionType: action,
                    objectOriginalValues: value,
                    objectNewValues: value,
                    idsToUpdate: [data[field.name]._id],
                }, dbSession);

                // Mount query and update to create the reverse lookup
                reverseLookupQuery = { _id: data[field.name]._id };

                reverseLookupUpdate = { $set: value };

                // If reverse lookup is list then add lookup to array and set inherited fields
                if (reverseLookupMeta.fields[field.reverseLookup].isList === true) {
                    reverseLookupUpdate.$push = {};
                    reverseLookupUpdate.$push[field.reverseLookup] = reverseLookupUpdate.$set[field.reverseLookup];
                    delete reverseLookupUpdate.$set[field.reverseLookup];
                    if (Object.keys(reverseLookupUpdate.$set).length === 0) {
                        delete reverseLookupUpdate.$set;
                    }
                }

                const reverseUpdateResult = await reverseLookupCollection.updateMany(reverseLookupQuery, reverseLookupUpdate, { session: dbSession });

                if (reverseUpdateResult.modifiedCount > 0) {
                    logger.info(`∞ ${field.document}.${field.reverseLookup} < ${metaName} (${reverseUpdateResult.modifiedCount})`);
                }
            }
        }
    });
}