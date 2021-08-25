import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';
import size from 'lodash/size';
import map from 'lodash/map';
import identity from 'lodash/identity';

import { MetaObject } from 'metadata';
import { registerMethod } from 'utils/methods';
import { getAccessFor } from 'utils/access';

const init = () => {
	/* Get system menu
		@param authTokenId
	*/
	registerMethod('menu', 'withUser', async function (request) {
		const list = {};

		const accessCache = {};

		const getAccess = documentName => {
			if (!accessCache[documentName]) {
				accessCache[documentName] = getAccessFor(documentName, this.user);
			}
			return accessCache[documentName];
		};

		const accesses = [];

		await MetaObject.find({ type: { $nin: ['namespace', 'access'] } }, { sort: { _id: 1 } }).forEach(metaObject => {
			let value;
			metaObject.namespace = Namespace.ns;

			metaObject._id = `${metaObject.namespace}:${metaObject._id}`;

			let access;
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
				metaObject.access = `${metaObject.namespace}:${access._id}`;
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
				for (const field of metaObject.fields) {
					if (field.type === 'lookup' && size(get(field, 'inheritedFields')) > 0) {
						field.type = 'inheritLookup';
					}
				}
			}

			list[metaObject._id] = metaObject;
		});

		await MetaObject.find({ _id: { $in: accesses } }).forEach(metaObject => {
			metaObject.namespace = Namespace.ns;

			metaObject._id = `${metaObject.namespace}:${metaObject._id}`;

			list[metaObject._id] = metaObject;
		});

		return list;
	});

	registerMethod('documents', 'withUser', async function () {
		const { user } = this;

		const docsResult = (await MetaObject.find({ type: 'document' }, { sort: { menuSorter: 1 } }).toArray()) || [];

		const documents = docsResult.reduce((acc, { _id, name, menuSorter, label, plurals }) => {
			const access = getAccessFor(name, user);

			if (access) {
				return [...acc, { _id, name, menuSorter, label, plurals }];
			}
			return acc;
		}, []);

		return documents;
	});

	registerMethod('document', 'withUser', async function ({ document: documentId }) {
		const { user } = this;

		const document = await MetaObject.findOne({ _id: documentId, type: 'document' });

		if (document != null) {
			const { _id, name, label, plurals, fields } = document;
			return {
				_id,
				name,
				label,
				plurals,
				fields: map(fields, identity),
			};
		}
		return null;
	});
};

export { init };
