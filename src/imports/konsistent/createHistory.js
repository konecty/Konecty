import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import get from 'lodash/get';
import omitBy from 'lodash/omitBy';
import pick from 'lodash/pick';
import { v4 as uuidV4 } from 'uuid';

export default async function createHistory(metaName, action, id, updatedBy, updatedAt, changed, dbSession) {
	if (Object.keys(changed).length === 0 || updatedAt == null || updatedBy == null) {
		return true;
	}

	const keysToIgnore = ['_updatedAt', '_createdAt', '_deletedAt', '_updatedBy', '_createdBy', '_deletedBy', '_id'];
	const meta = MetaObject.Meta[metaName];

	const history = MetaObject.Collections[`${metaName}.History`];
	if (!history) {
		logger.error(`Can't get History collection from ${metaName}`);
		return false;
	}

	const historyData = omitBy(changed, (value, key) => keysToIgnore.includes(key) || meta.fields[key]?.ignoreHistory);
	if (Object.keys(historyData).length === 0) {
		logger.trace(`No history data for ${metaName}`);
		return true;
	}

	const userDescriptionFields = ['_id'].concat(get(meta, 'fields._user.descriptionFields', ['name', 'active']));
	const historyItem = {
		_id: uuidV4(),
		dataId: id,
		createdAt: updatedAt,
		createdBy: pick(updatedBy, userDescriptionFields),
		data: historyData,
		type: action,
	};

	try {
		await history.insertOne(historyItem, { session: dbSession });
		return true;
	} catch (e) {
		logger.error(e, 'Error on create history');
		return false;
	}
}
