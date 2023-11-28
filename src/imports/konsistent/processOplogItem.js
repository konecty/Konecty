import createHistory from "lib/createHistory";
import processAlertsForOplogItem from "lib/oplogAlerts";
import processReverseLookups from "lib/processReverseLookups";
import * as References from "lib/updateReferences";

import { CronJob } from 'cron';
import { DateTime } from 'luxon';

import get from 'lodash/get';
import omit from 'lodash/omit';

import { MetaObject } from '@imports/model/MetaObject';

import { db } from '../database';
import { logger } from '../utils/logger';

const KONSISTENT_SCHEDULE = process.env.KONSISTENT_SCHEDULE || '*/1 * * * *';
const TZ = process.env.TZ || 'America/Sao_Paulo';

const konsistentJob = new CronJob(KONSISTENT_SCHEDULE, processOplogItem, null, false, TZ);

export default async function processOplogItem() {
    if (konsistentJob.running === false) {
        logger.debug('Konsistent processOplogItem is running');
        return;
    }
    konsistentJob.stop();

    const konsistentChangesCollection = db.collection('KonsistentChanges');

    const change = await konsistentChangesCollection.findOneAndUpdate(
        { processTS: { $exists: false }, processStartTS: { $exists: false }, $or: [{ errorCount: { $exists: false } }, { errorCount: { $gte: 3 } }] },
        { $set: { processStartTS: new Date() } },
        { sort: { _id: 1 } },
    );

    if (change?.value == null) {
        logger.debug('No changes to process');
        konsistentJob.start();
        return;
    }

    try {
        const keysToIgnore = ['_updatedAt', '_createdAt', '_deletedAt', '_updatedBy', '_createdBy', '_deletedBy'];

        let startTime = process.hrtime();

        const { _id, type: action, meta: metaName, data, dataId, ts, updatedBy, updatedAt } = change.value;

        // Update relatinos if action was an update
        if (action === 'update') {
            await References.updateLookups(metaName, dataId, data);

            const totalTime = process.hrtime(startTime);
            logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Update lookup references for ${metaName}`);
        }

        startTime = process.hrtime();

        await processReverseLookups(metaName, dataId, data, action);

        const totalTime = process.hrtime(startTime);
        logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process reverse lookups for ${metaName}`);

        startTime = process.hrtime();

        // Update documents with relations to this document
        await References.updateRelations(metaName, action, dataId, data);

        const updateRelationsTime = process.hrtime(startTime);
        logger.debug(`${updateRelationsTime[0]}s ${updateRelationsTime[1] / 1000000}ms => Update relation references for ${metaName}`);

        // Remove some internal data

        // Verify if meta of record was setted to save history
        if (get(MetaObject.Meta, `${metaName}.saveHistory`, false) === true) {
            await createHistory(metaName, action, dataId, omit(data, keysToIgnore), updatedBy, updatedAt, _id);
        }

        await konsistentChangesCollection.updateOne({ _id: _id }, { $set: { processTS: DateTime.local().toJSDate() }, $unset: { processStartTS: 1 } });

        startTime = process.hrtime();
        await saveLastOplogTimestamp(ts);

        const oplogTime = process.hrtime(startTime);
        logger.debug(`${oplogTime[0]}s ${oplogTime[1] / 1000000}ms => Save last oplog timestamp`);

        await processAlertsForOplogItem(metaName, action, _id, data, updatedBy, updatedAt);
    } catch (e) {
        logger.error(e, 'Error on process oplog item');
        await konsistentChangesCollection.updateOne({ _id: change.value._id }, { $set: { processError: e }, $inc: { errorCount: 1 }, $unset: { processStartTS: 1 } });
    }
    konsistentJob.start();
    return setTimeout(processOplogItem, 0);
}

async function saveLastOplogTimestamp(ts) {
    const query = { _id: 'LastProcessedOplog' };

    try {
        const lastProcessedOplog = await db.collection('Konsistent').findOne(query);

        if (lastProcessedOplog == null) {
            return db.collection('Konsistent').insertOne({ _id: 'LastProcessedOplog', ts });
        }

        if (lastProcessedOplog.ts == null || lastProcessedOplog.ts.greaterThan(ts)) {
            return db.collection('Konsistent').updateOne(query, { $set: { ts } });
        }
    } catch (e) {
        logger.error(
            {
                error: e,
            },
            'Error on save last oplog timestamp',
        );
    }
}