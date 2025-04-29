import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { logger } from '@imports/utils/logger';
import BluebirdPromise from 'bluebird';
import pick from 'lodash/pick';

type NamespaceWebhookParams = {
	action: 'create' | 'update' | 'delete';
	ids: string[];
	metaName: string;
	user: User;
	data?: any; // Data is for use with delete action
};

type WebhookData = {
	action: 'create' | 'update' | 'delete';
	ns: string;
	documentName: string;
	user: User;
	data: any;
};

const actionMap: Record<NamespaceWebhookParams['action'], 'onCreate' | 'onUpdate' | 'onDelete'> = {
	create: 'onCreate',
	update: 'onUpdate',
	delete: 'onDelete',
};

export async function runNamespaceWebhook({ action, ids, metaName, user, data }: NamespaceWebhookParams) {
	const hookUrl = MetaObject.Namespace[actionMap[action]];
	if (hookUrl == null) {
		return;
	}

	const hookData: WebhookData = {
		action,
		ns: MetaObject.Namespace.ns,
		documentName: metaName,
		user: pick(user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']) as User,
		data,
	};

	if (action !== 'delete') {
		hookData.data = await MetaObject.Collections[metaName].find({ _id: { $in: ids } }).toArray();
	}

	const urls = Array.isArray(hookUrl) ? hookUrl : [hookUrl];

	await BluebirdPromise.mapSeries(urls, async url => {
		try {
			if (typeof url !== 'string') {
				return;
			}

			const hookUrl = url.replace('${dataId}', ids.join(',')).replace('${documentId}', `${hookData.ns}:${metaName}`);
			const hookResponse = await fetch(hookUrl, {
				method: 'POST',
				body: JSON.stringify(hookData),
			});
			if (hookResponse.status === 200) {
				logger.info(`Hook ${hookUrl} executed successfully`);
			} else {
				logger.error(`Error on hook ${url}: ${hookResponse.statusText}`);
			}
		} catch (e) {
			logger.error(e, `Error on hook ${url}: ${(e as Error).message}`);
		}
	});
}
