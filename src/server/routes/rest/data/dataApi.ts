import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import concat from 'lodash/concat';
import first from 'lodash/first';
import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import set from 'lodash/set';

import { flatten } from 'flat';

import { MetaObject } from '@imports/model/MetaObject';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

import { create, deleteData, find, findById, findByLookup, getNextUserFromQueue, historyFind, relationCreate, saveLead, update } from '@imports/data/data';

import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor } from '@imports/utils/accessUtils';
import { errorReturn } from '@imports/utils/return';

import { csvExport } from '@imports/exports/csvExport';
import { xlsExport } from '@imports/exports/xlsExport';
import { List } from '@imports/model/List';

export const dataApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{ Body: { lead: unknown; save: unknown } }>('/rest/data/lead/save', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const lead = req.body.lead;
		const save = req.body.save;
		const result = await saveLead({
			authTokenId,
			lead,
			save,
		} as any);
		reply.send(result);
	});

	fastify.get<{
		Params: { document: string };
		Querystring: { displayName: string; displayType: string; fields: string; filter: string; sort: string; limit: string; start: string; withDetailFields: string };
	}>('/rest/data/:document/find', async (req, reply) => {
		if (req.query.filter != null && isString(req.query.filter)) {
			req.query.filter = JSON.parse(req.query.filter.replace(/\+/g, ' '));
		}

		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: req.query.filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
		} as any);
		reply.send(result);
	});

	fastify.post<{
		Params: { document: string };
		Querystring: {
			displayName: string;
			displayType: string;
			fields: string;
			filter: unknown;
			sort: unknown;
			limit: number;
			start: number;
			withDetailFields: boolean;
		};
		Body: unknown;
	}>('/rest/data/:document/find', async (req, reply) => {
		if (isObject(req.body)) {
			req.query.filter = req.body;
		}

		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: req.query.filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
		} as any);
		reply.send(result);
	});

	fastify.get<{ Params: { document: string; queueId: string } }>('/rest/data/:document/queue/next/:queueId', async (req, reply) => {
		const result = await getNextUserFromQueue({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			queueId: req.params.queueId,
		} as any);

		reply.send(result);
	});

	fastify.get<{ Params: { document: string; dataId: string }; Querystring: { fields?: string; withDetailFields: string } }>(
		'/rest/data/:document/:dataId',
		async (req, reply) => {
			const result = await findById({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				fields: req.query.fields,
				dataId: req.params.dataId,
				withDetailFields: req.query.withDetailFields,
			});

			reply.send(result);
		},
	);

	fastify.get<{ Params: { document: string; field: string }; Querystring: { search: string; filter: string; start: string; limit: string; useChangeUserFilter: string } }>(
		'/rest/data/:document/lookup/:field',
		async (req, reply) => {
			const extraFilter = isString(req.query.filter) ? JSON.parse(req.query.filter) : undefined;

			const result = await findByLookup({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				field: req.params.field,
				search: req.query.search,
				extraFilter,
				start: req.query.start,
				limit: req.query.limit,
				useChangeUserFilter: req.query.useChangeUserFilter === 'true',
			});

			reply.send(result);
		},
	);

	fastify.post<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const result = await create({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.put<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const result = await update({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.delete<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const result = await deleteData({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.post<{ Params: { document: string; fieldName: string }; Body: unknown }>('/rest/data/:document/relations/:fieldName', async (req, reply) => {
		const result = await relationCreate({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.post<{ Params: { document: string; fieldName: string }; Body: unknown }>('/rest/data/:document/relations/:fieldName/preview', async (req, reply) => {
		const result = await relationCreate({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
			preview: true,
		} as any);

		reply.send(result);
	});

	fastify.get<{ Params: { document: string; dataId: string }; Querystring: { fields: string } }>('/rest/data/:document/:dataId/history', async (req, reply) => {
		const result = await historyFind({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
			fields: req.query.fields,
		} as any);

		reply.send(result);
	});

	fastify.get<{
		Params: { document: string; listName: string; type: string };
		Querystring: {
			filter: unknown;
			sort?: unknown;
			fields?: string;
			displayName?: string;
			displayType?: string;
			limit?: number;
			start?: number;
		};
	}>('/rest/data/:document/list/:listName/:type', async function (req, res) {
		const authTokenId = getAuthTokenIdFromReq(req);
		const { success, data: user, errors } = (await getUserSafe(authTokenId)) as any;
		if (success === false) {
			return errorReturn(errors);
		}

		const { document, listName, type } = req.params;

		const access = getAccessFor(document, user);
		if (access === false || access.isReadable !== true) {
			return errorReturn(`[${document}] You don't have permission to read records`);
		}

		if (['csv', 'xls'].includes(type) === false) {
			return errorReturn(`[${document}] Value for type must be one of [csv, xls]`);
		}

		const listMeta = (await MetaObject.MetaObject.findOne({
			type: 'list',
			document,
			name: listName,
		})) as List;

		if (listMeta == null) {
			return errorReturn(`[${document}] Can't find meta for list ${listName} of document ${document}`);
		}

		const metaObject = get(MetaObject.Meta, document);

		if (metaObject == null) {
			return errorReturn(`[${document}] Can't find meta`);
		}

		const userLocale = user.locale ?? 'en';

		const getLabel = () => {
			if (listMeta.plurals != null) {
				return listMeta.plurals[userLocale] ?? listMeta.plurals.en ?? first(Object.values(listMeta.plurals));
			}
			if (listMeta.label != null) {
				return listMeta.label[userLocale] ?? listMeta.label.en ?? first(Object.values(listMeta.label));
			}
			if (metaObject.plurals != null) {
				return metaObject.plurals[userLocale] ?? metaObject.plurals.en ?? first(Object.values(metaObject.plurals));
			}
			if (metaObject.label != null) {
				return metaObject.label[userLocale] ?? metaObject.label.en ?? first(Object.values(metaObject.label));
			}
			return document;
		};

		const name = getLabel();

		if (isString(req.query.filter) === false && isObject(listMeta.filter)) {
			req.query.filter = JSON.stringify(listMeta.filter);
		}

		if (isString(req.query.sort) === false && isArray(listMeta.sorters)) {
			req.query.sort = JSON.stringify(listMeta.sorters);
		}

		const getFields = () => {
			if (isString(req.query.fields)) {
				return req.query.fields;
			}
			if (isObject(listMeta.columns)) {
				return Object.values(listMeta.columns)
					.filter(column => column.visible === true)
					.map(column => column.linkField)
					.join(',');
			}
			return undefined;
		};

		const fields = getFields();

		const filter = isString(req.query.filter) ? JSON.parse(req.query.filter) : undefined;

		const result = await find({
			contextUser: user,
			document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields,
			filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: 'true',
			getTotal: true,
		} as any);

		if (result == null || result.success === false) {
			return res.send(result);
		}

		const dataResult = (get(result, 'data', []) as Array<unknown>).reduce(
			(acc, item) => {
				const flatItem = flatten(item);
				set(acc as object, 'flatData', concat(get(acc, 'flatData', []), flatItem));
				Object.keys(flatItem as object).forEach(key => set(acc as object, `keys.${key}`, 1));
				return acc;
			},
			{ flatData: [], keys: {} },
		);

		if (type === 'xls') {
			return xlsExport(Object.keys(get(dataResult, 'keys', {})), get(dataResult, 'flatData', []), name, res);
		} else {
			return csvExport(Object.keys(get(dataResult, 'keys', {})), get(dataResult, 'flatData', []), name, res);
		}
	});

	done();
};

export default fp(dataApi);
