import { MetaObject } from "@imports/model/MetaObject";
import { logger } from "@imports/utils/logger";
import get from "lodash/get";

export default async function createHistory(metaName, action, id, data, updatedBy, updatedAt, changeId) {
    // If data is empty or no update data is avaible then abort
    if (Object.keys(data).length === 0 || updatedAt == null || updatedBy == null) {
        return;
    }

    const startTime = process.hrtime();

    const historyData = {};

    const meta = MetaObject.Meta[metaName];

    // Remove fields that is marked to ignore history
    for (let key in data) {
        const value = data[key];
        const field = meta.fields[key];
        if (get(field, 'ignoreHistory', false) !== true) {
            historyData[key] = value;
        }
    }

    // Get history collection
    const history = MetaObject.Collections[`${metaName}.History`];

    // If can't get history collection terminate this method
    if (!history) {
        return logger.error(`Can't get History collection from ${metaName}`);
    }

    const historyQuery = { _id: changeId };

    const userDetailFields = ["_id"].concat(get(meta, "fields._user.detailFields", ["name", "active"]));

    // Define base data to history
    const historyItem = {
        dataId: id,
        createdAt: updatedAt,
        createdBy: get(updatedBy, userDetailFields),
        data: historyData,
        type: action,
    };

    // Create history!
    try {
        await history.updateOne(historyQuery, { $set: historyItem, $setOnInsert: historyQuery }, { upsert: true });

        const updateTime = process.hrtime(startTime);
        // Log operation to shell
        let log = metaName;

        switch (action) {
            case 'create':
                log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to create action over  ${log}`;
                break;
            case 'update':
                log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to update action over ${log}`;
                break;
            case 'delete':
                log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to delete action over ${log}`;
                break;
        }

        logger.debug(log);
    } catch (e) {
        logger.error(e, 'Error on create history');
    }
}