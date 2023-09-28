import BluebirdPromise from 'bluebird';

import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';
import size from 'lodash/size';
import map from 'lodash/map';
import identity from 'lodash/identity';

import { getAccessFor } from '/imports/utils/accessUtils';
import { MetaObjectCollection } from '/imports/model/MetaObject';
import { getUserSafe } from '/imports/auth/getUser';
import { errorReturn } from '/imports/utils/return';

/* Get system menu
	@param authTokenId
*/

export async function menuFull({ authTokenId }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const list = {};

	const accessCache = {};

	const getAccess = documentName => {
		if (!accessCache[documentName]) {
			accessCache[documentName] = getAccessFor(documentName, user);
		}
		return accessCache[documentName];
	};

	const namespace = await MetaObjectCollection.findOne({ _id: 'Namespace' });

	const accesses = [];

	const metaObjectsToValidate = await MetaObjectCollection.find({ type: { $nin: ['namespace', 'access'] } }, { sort: { _id: 1 } }).toArray();

	await BluebirdPromise.each(metaObjectsToValidate, async function (metaObject) {
		let value;
		metaObject.namespace = namespace.ns;

		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		let access = undefined;
		if (metaObject.document) {
			access = getAccess(metaObject.document);
		} else {
			access = getAccess(metaObject.name);
		}

		if (access === false && !['document', 'composite'].includes(metaObject.type)) {
			return;
		}

		if (['document', 'composite'].includes(metaObject.type) && isObject(access)) {
			accesses.push(access._id);
			metaObject.access = metaObject.namespace + ':' + access._id;
		}

		const columns = [];

		for (var key in metaObject.columns) {
			value = metaObject.columns[key];
			columns.push(value);
		}

		metaObject.columns = columns;

		if (metaObject.oldVisuals) {
			metaObject.visuals = metaObject.oldVisuals;
			delete metaObject.oldVisuals;
		}

		if (metaObject.columns.length === 0) {
			delete metaObject.columns;
		}

		const fields = [];

		for (key in metaObject.fields) {
			value = metaObject.fields[key];
			fields.push(value);
		}

		metaObject.fields = fields;

		if (metaObject.fields.length === 0) {
			delete metaObject.fields;
		}

		if (isArray(metaObject.fields)) {
			for (let field of metaObject.fields) {
				if (field.type === 'lookup' && size(get(field, 'inheritedFields')) > 0) {
					field.type = 'inheritLookup';
				}
			}
		}

		list[metaObject._id] = metaObject;
	});

	const metadatas = await MetaObjectCollection.find({ _id: { $in: accesses } }).toArray();

	await BluebirdPromise.each(metadatas, async function (metaObject) {
		metaObject.namespace = namespace.ns;

		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		list[metaObject._id] = metaObject;
	});

	return list;
}

export async function metaDocuments({ authTokenId }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const metaDocuments = await MetaObjectCollection.find({ type: 'document' }, { sort: { menuSorter: 1 } }).toArray();

	const result = metaDocuments.reduce((acc, { _id, name, menuSorter, label, plurals }) => {
		const access = getAccessFor(name, user);

		if (access) {
			return [...acc, { _id, name, menuSorter, label, plurals }];
		}
		return acc;
	}, []);

	return result;
}

export async function metaDocument({ document, authTokenId, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const metaDocument = await MetaObjectCollection.findOne({ _id: document, type: 'document' });

	if (metaDocument == null) {
		return null;
	}

	const access = getAccessFor(document, user);

	if (metaDocument != null && access != false) {
		const { _id, name, label, plurals, fields } = metaDocument;
		return {
			_id,
			name,
			label,
			plurals,
			fields: map(fields, identity),
		};
	}

	return null;
}