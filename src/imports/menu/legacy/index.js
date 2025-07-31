import BluebirdPromise from 'bluebird';

import get from 'lodash/get';
import identity from 'lodash/identity';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import map from 'lodash/map';
import size from 'lodash/size';

import { getUserSafe } from '@imports/auth/getUser';
import { isPlainObject } from 'lodash';
import { MetaObject } from '../../model/MetaObject';
import { getAccessFor } from '../../utils/accessUtils';
import { shouldFilterMetaObjectFromMenu, getMenuSorterFromAccess } from '../../utils/menuFilteringUtils';
import { errorReturn } from '../../utils/return';

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

	const namespace = await MetaObject.MetaObject.findOne({ _id: 'Namespace' });

	const accesses = [];

	const metaObjectsToValidate = await MetaObject.MetaObject.find({ type: { $nin: ['namespace', 'access'] } }, { sort: { _id: 1 } }).toArray();

	await BluebirdPromise.each(metaObjectsToValidate, async function (metaObject) {
		metaObject.namespace = namespace.ns;
		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		const access = getAccess(metaObject.document ?? metaObject.name);

		if (access === false && !['document', 'composite'].includes(metaObject.type)) {
			return;
		}

		// Check if this meta object should be filtered from menu based on access configuration
		if (access !== false && isObject(access) && shouldFilterMetaObjectFromMenu(access, metaObject)) {
			return;
		}

		// Apply menuSorter override from access configuration
		if (access !== false && isObject(access) && metaObject.menuSorter !== undefined) {
			metaObject.menuSorter = getMenuSorterFromAccess(access, metaObject.name, metaObject.menuSorter);
		}

		if (['document', 'composite'].includes(metaObject.type) && isObject(access)) {
			accesses.push(access._id);
			metaObject.access = metaObject.namespace + ':' + access._id;
		}

		if (metaObject.oldVisuals) {
			metaObject.visuals = metaObject.oldVisuals;
			delete metaObject.oldVisuals;
		}

		metaObject.columns = metaObject.columns ? Object.values(metaObject.columns) : [];
		metaObject.fields = metaObject.fields ? Object.values(metaObject.fields) : [];

		if (metaObject.columns.length === 0) {
			delete metaObject.columns;
		}

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

		if (metaObject.filter && isPlainObject(metaObject.filter.conditions)) {
			for (const key in metaObject.filter.conditions) {
				const item = metaObject.filter.conditions[key];

				if (item?.value instanceof Date) {
					item.value = { $date: item.value.toISOString() };
					metaObject.filter.conditions[key] = item;
				}
			}
		}

		list[metaObject._id] = metaObject;
	});

	const metadatas = await MetaObject.MetaObject.find({ _id: { $in: accesses } }).toArray();

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

	const metaDocuments = await MetaObject.MetaObject.find({ type: 'document' }, { sort: { menuSorter: 1 } }).toArray();

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

	const metaDocument = await MetaObject.MetaObject.findOne({ _id: document, type: 'document' });

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
