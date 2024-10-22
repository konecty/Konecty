import { MetaObject } from "@imports/model/MetaObject";
import { logger } from "@imports/utils/logger";
import get from "lodash/get";
import omitBy from "lodash/omitBy";
import pick from "lodash/pick";
import { v4 as uuidV4 } from 'uuid';

export default async function createHistory(metaName, action, id, updatedBy, updatedAt, changed, dbSession) {
    // If data is empty or no update data is avaible then abort
    if (Object.keys(changed).length === 0 || updatedAt == null || updatedBy == null) {
        return;
    }

    const keysToIgnore = ['_updatedAt', '_createdAt', '_deletedAt', '_updatedBy', '_createdBy', '_deletedBy'];
    const changeId = uuidV4();
    const meta = MetaObject.Meta[metaName];

    const history = MetaObject.Collections[`${metaName}.History`];
    if (!history) {
        return logger.error(`Can't get History collection from ${metaName}`);
    }

    const userDetailFields = ["_id"].concat(get(meta, "fields._user.descriptionFields", ["name", "active"]));
    const historyItem = {
        dataId: id,
        createdAt: updatedAt,
        createdBy: pick(updatedBy, userDetailFields),
        data: omitBy(changed, (value, key) => keysToIgnore.includes(key) || meta.fields[key]?.ignoreHistory),
        type: action,
    };

    try {
        const historyQuery = { _id: changeId };
        await history.updateOne(historyQuery, { $set: historyItem, $setOnInsert: historyQuery }, { upsert: true, session: dbSession });
    } catch (e) {
        logger.error(e, 'Error on create history');
    }
}