import { MetaObject } from "@imports/model/MetaObject";
import { logger } from "@imports/utils/logger";
import get from "lodash/get";
import pick from "lodash/pick";
import { v4 as uuidV4 } from 'uuid';

export default async function createHistory(metaName, action, id, data, updatedBy, updatedAt, changed) {
    // If data is empty or no update data is avaible then abort
    if (Object.keys(data).length === 0 || updatedAt == null || updatedBy == null) {
        return;
    }

    const changeId = uuidV4();
    const historyData = {};

    const meta = MetaObject.Meta[metaName];

    // Remove fields marked to ignore history
    for (let key in changed) {
        const value = data[key];
        const field = meta.fields[key];
        if (get(field, 'ignoreHistory', false) !== true) {
            historyData[key] = value;
        }
    }

    // Get history collection
    const history = MetaObject.Collections[`${metaName}.History`];
    if (!history) {
        return logger.error(`Can't get History collection from ${metaName}`);
    }

    const historyQuery = { _id: changeId };

    const userDetailFields = ["_id"].concat(get(meta, "fields._user.detailFields", ["name", "active"]));

    const historyItem = {
        dataId: id,
        createdAt: updatedAt,
        createdBy: pick(updatedBy, userDetailFields),
        data: historyData,
        type: action,
    };

    try {
        await history.updateOne(historyQuery, { $set: historyItem, $setOnInsert: historyQuery }, { upsert: true });
    } catch (e) {
        logger.error(e, 'Error on create history');
    }
}