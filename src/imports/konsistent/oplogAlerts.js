import BluebirdPromise from 'bluebird';

import get from 'lodash/get';
import has from 'lodash/has';

import { MetaObject } from '@imports/model/MetaObject';

import { formatValue, getLabel } from '../konsistent/utils';
import { logger } from '../utils/logger';

export default async function processAlertsForOplogItem(metaName, action, _id, data, updatedBy, updatedAt) {
    let field, userRecords, value;
    if (!updatedBy) {
        return;
    }

    if (!updatedAt) {
        return;
    }

    if (data._merge) {
        return;
    }

    const meta = MetaObject.Meta[metaName];

    if (!meta) {
        return logger.error(`Can't get meta for ${metaName}`);
    }

    if (meta.sendAlerts !== true) {
        return;
    }

    const collection = MetaObject.Collections[metaName];

    if (collection == null) {
        return logger.error(`Can't get model for ${metaName}`);
    }

    const userCollection = MetaObject.Collections['User'];

    if (userCollection == null) {
        return logger.error("Can't get model for User");
    }
    const startTime = process.hrtime();
    let { code } = data;
    const usersToFindEmail = [];
    let users = [];
    if (data._user) {
        users = users.concat(data._user);
    }

    if (action === 'update') {
        const query = { _id };

        const options = {
            projection: {
                _user: 1,
                code: 1,
            },
        };

        const updatedRecord = await collection.findOne(query, options);
        ({ code } = updatedRecord);
        if (updatedRecord._user) {
            users = users.concat(updatedRecord._user);
        }
    }

    for (var user of users) {
        if (user && user._id !== updatedBy._id) {
            usersToFindEmail.push(user._id);
        }
    }

    if (usersToFindEmail.length === 0) {
        return;
    }

    const userQuery = {
        _id: {
            $in: usersToFindEmail,
        },
        active: true,
    };

    const userOptions = {
        projection: {
            username: 1,
            emails: 1,
            locale: 1,
        },
    };

    try {
        userRecords = await userCollection.find(userQuery, userOptions).toArray();
    } catch (e) {
        logger.error(e, `Error on find users for ${metaName} ${_id}`);
    }

    let actionText = 'Apagado';
    switch (action) {
        case 'create':
            actionText = 'Criado';
            break;
        case 'update':
            actionText = 'Alterado';
            break;
    }

    const excludeKeys = ['_updatedAt', '_updatedBy', '_createdAt', '_createdBy', '_deletedAt', '_deletedBy'];

    // Ignore fields that is marked to ignore history
    for (var key in data) {
        value = data[key];
        field = meta.fields[key];
        if (get(field, 'ignoreHistory') === true) {
            excludeKeys.push(key);
        }
    }

    await BluebirdPromise.mapSeries(userRecords, async user => {
        const rawData = {};
        const dataArray = [];

        for (key in data) {
            value = data[key];
            if (!excludeKeys.includes(key)) {
                // if (key === '_id') {
                // 	value = value;
                // } ?????

                field = key.split('.')[0];
                field = meta.fields[field];

                rawData[key] = value;

                if (field) {
                    dataArray.push({
                        field: getLabel(field, user) || key,
                        value: formatValue(value, field),
                    });
                } else {
                    dataArray.push({
                        field: getLabel(field, user) || key,
                        value,
                    });
                }
            }
        }

        if (get(dataArray, 'length') === 0) {
            return;
        }

        const documentName = getLabel(meta, user) || meta.name;

        const alertData = {
            documentName,
            action,
            actionText,
            code,
            _id,
            _updatedBy: updatedBy,
            _updatedAt: updatedAt,
            data: dataArray,
            rawData,
            user,
        };

        if (has(user, 'emails.0.address')) {
            const emailData = {
                from: 'Konecty Alerts <alerts@konecty.com>',
                to: get(user, 'emails.0.address'),
                subject: `[Konecty] Dado em: ${documentName} com code: ${code} foi ${actionText}`,
                template: 'alert.hbs',
                data: alertData,
                type: 'Email',
                status: 'Send',
                discard: true,
            };
            await MetaObject.Collections['Message'].insertOne(emailData);
        }
    });

    const totalTime = process.hrtime(startTime);
    logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process alerts for oplog item for ${metaName}`);
}