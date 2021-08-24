import { db } from 'database';

import defer from 'lodash/defer';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';

let Models = {};
let Meta = {};
let DisplayMeta = {};
let Access = {};
let References = {};
let Namespace = {};
let MetaObject;

let rebuildReferencesTimer = null;
const rebuildReferencesDelay = 1000;

const rebuildReferences = () => {
	console.info('[metadata] Rebuilding references'.yellow);
	References = {};

	for (const metaName in Meta) {
		const meta = Meta[metaName];
		for (let fieldName in meta.fields) {
			const field = meta.fields[fieldName];
			if (field.type === 'lookup') {
				if (!References[field.document]) {
					References[field.document] = { from: {} };
				}
				if (!References[field.document].from[metaName]) {
					References[field.document].from[metaName] = {};
				}
				References[field.document].from[metaName][fieldName] = {
					type: field.type,
					field: fieldName,
					isList: field.isList,
					descriptionFields: field.descriptionFields,
					detailFields: field.detailFields,
				};
			}
		}
	}
	if (rebuildReferencesTimer != null) {
		clearTimeout(rebuildReferencesTimer);
	}
	rebuildReferencesTimer = null;
};

const tryEnsureIndex = async (model, fields, options) => {
	if (model == null) {
		return;
	}
	try {
		await model.createIndex(fields, options);
	} catch (e) {
		if (e.toString().indexOf('already exists with different options') !== -1 || e.toString().indexOf('already exists with a different name') !== -1) {
			return;
		} else if (e.toString().indexOf('too many indexes for') !== -1) {
			console.error(`Too many indexes for ${collection.collectionName}`.red);
		} else {
			console.error(`Index Error: ${e.toString()}`.red);
		}
	}
};

const registerMeta = function (meta) {
	if (!meta.collection) {
		meta.collection = `data.${meta.name}`;
	}
	Meta[meta.name] = meta;

	if (meta.type === 'document') {
		meta.fields._merge = {
			name: '_merge',
			type: 'text',
			isList: true,
		};
	}

	if (!Models[meta.name]) {
		Models[`${meta.name}.Comment`] = db.collection(`${meta.collection}.Comment`);
		Models[`${meta.name}.History`] = db.collection(`${meta.collection}.History`);
		Models[`${meta.name}.Trash`] = db.collection(`${meta.collection}.Trash`);
		Models[`${meta.name}.AutoNumber`] = db.collection(`${meta.collection}.AutoNumber`);

		if (meta.collection === 'users') {
			Models[meta.name] = db.collection('users');
		} else {
			Models[meta.name] = db.collection(meta.collection);
		}

		const processIndexes = async () => {
			let fieldName, fields, key, keys, options;

			// Create index for TTL in ActiveSessions
			if (meta.name === 'ActiveSessions') {
				fieldName = 'expireAt';
				fields = {};
				fields[fieldName] = 1;
				await tryEnsureIndex(Models[meta.name], fields, {
					name: fieldName,
					expireAfterSeconds: 60,
				});
			}

			// Create indexes for history collections
			const historyIndexes = ['dataId', 'createdAt'];
			for (let historyIndex of historyIndexes) {
				fields = {};
				fields[historyIndex] = 1;
				await tryEnsureIndex(Models[`${meta.name}.History`], fields, {
					name: historyIndex,
				});
			}

			// Create indexes for comment collections
			const commentIndexes = ['dataId', '_createdAt'];
			for (let commentIndex of commentIndexes) {
				fields = {};
				fields[commentIndex] = 1;
				await tryEnsureIndex(Models[`${meta.name}.Comment`], fields, {
					name: commentIndex,
				});
			}

			// Create indexes for each field that is sortable
			for (fieldName in meta.fields) {
				const field = meta.fields[fieldName];
				if (!['richText', 'composite'].includes(field.type)) {
					if (field.isSortable === true || field.isUnique === true || ['lookup', 'address', 'autoNumber'].includes(field.type)) {
						let subFields = [''];

						switch (field.type) {
							case 'lookup':
								subFields = ['._id'];
								break;
							case 'email':
								subFields = ['.address'];
								break;
							case 'money':
								subFields = ['.value'];
								break;
							case 'personName':
								subFields = ['.full'];
								break;
							case 'phone':
								subFields = ['.phoneNumber', '.countryCode'];
								break;
							case 'address':
								subFields = ['.country', '.state', '.city', '.district', '.place', '.number', '.complement', '.postalCode', '.placeType'];
								break;
						}

						options = {
							unique: 0,
							name: fieldName,
						};

						if (field.type === 'autoNumber' || field.isUnique === true) {
							options.unique = 1;
						}

						if (field.isUnique === true && field.isRequired !== true) {
							options.sparse = 1;
						}

						if (['username', 'emails'].includes(field.name) && meta.name === 'User') {
							options.unique = 1;
							options.sparse = 1;
						}

						fields = {};

						for (let subField of subFields) {
							fields[fieldName + subField] = 1;
						}
						await tryEnsureIndex(Models[meta.name], fields, options);
					}
				}
			}

			// Create indexes for internal fields
			const metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id'];
			for (let metaDefaultIndex of metaDefaultIndexes) {
				fields = {};
				fields[metaDefaultIndex] = 1;

				await tryEnsureIndex(Models[meta.name], fields, { name: metaDefaultIndex });
			}

			// Create indexes defined in meta
			if (isObject(meta.indexes) && !isArray(meta.indexes) && Object.keys(meta.indexes).length > 0) {
				for (let indexName in meta.indexes) {
					const index = meta.indexes[indexName];
					if (!index.keys) {
						index.keys = {};
					}
					if (!index.options) {
						index.options = {};
					}
					if (!index.options.name) {
						index.options.name = indexName;
					}

					if (Object.keys(index.keys).length > 0) {
						keys = {};
						for (key in index.keys) {
							const direction = index.keys[key];
							keys[key.replace(/:/g, '.')] = direction;
						}

						await tryEnsureIndex(Models[meta.name], keys, index.options);
					}
				}
			}

			// Create text index
			if (isObject(meta.indexText) && !isArray(meta.indexText) && Object.keys(meta.indexText).length > 0) {
				keys = {};
				options = {
					name: 'TextIndex',
					default_language: Namespace.language,
					weights: {},
				};

				for (key in meta.indexText) {
					const weight = meta.indexText[key];
					key = key.replace(/:/g, '.');
					keys[key] = 'text';
					if (_.isNumber(weight) && weight > 0) {
						options.weights[key] = weight;
					}
				}

				await tryEnsureIndex(Models[meta.name], keys, options);
			}
		};

		if (isEmpty(process.env.DISABLE_REINDEX) || process.env.DISABLE_REINDEX === 'false' || process.env.DISABLE_REINDEX === '0') {
			defer(processIndexes);
		}
	}
};

const deregisterMeta = meta => {
	delete Meta[meta.name];

	delete Models[`${meta.name}.Comment`];
	delete Models[`${meta.name}.History`];
	delete Models[`${meta.name}.Trash`];
	delete Models[`${meta.name}.AutoNumber`];
	delete Models[meta.name];
};

const loadMetas = async () => {
	// Load access
	await MetaObject.find({ type: 'access' }).forEach(meta => {
		Access[meta._id] = meta;
	});

	// Load document types

	await MetaObject.find({ type: { $in: ['document', 'composite'] } }).forEach(meta => registerMeta(meta));

	await MetaObject.find({ type: { $in: ['pivot', 'view', 'list'] } }).forEach(meta => {
		DisplayMeta[meta._id] = meta;
	});

	Namespace = await MetaObject.findOne({ type: 'namespace' });

};

const init = async () => {
	MetaObject = db.collection('MetaObjects');

	await loadMetas();

	const metaChangeStream = await MetaObject.watch();

	metaChangeStream.on('change', ({ operationType, fullDocument, documentKey }) => {
		if (operationType === 'delete') {
			if (Access[documentKey._id] != null) {
				delete Access[documentKey._id];
			} else if (DisplayMeta[documentKey._id] != null) {
				delete DisplayMeta[documentKey._id];
			} else {
				deregisterMeta(documentKey);

				if (rebuildReferencesTimer != null) {
					clearTimeout(rebuildReferencesTimer);
				}
				rebuildReferencesTimer = setTimeout(rebuildReferences, rebuildReferencesDelay);
			}
		} else {
			switch (fullDocument.type) {
				case 'namespace':
					Namespace = fullDocument;
					break;
				case 'access':
					Access[fullDocument._id] = fullDocument;
					break;
				case 'document':
				case 'composite':
					registerMeta(fullDocument);
					if (rebuildReferencesTimer != null) {
						clearTimeout(rebuildReferencesTimer);
					}
					rebuildReferencesTimer = setTimeout(rebuildReferences, rebuildReferencesDelay);
					break;
				case 'pivot':
				case 'view':
				case 'list':
					DisplayMeta[fullDocument._id] = fullDocument;
					break;
			}
		}
	});
};

export { init, MetaObject, Models, Meta, DisplayMeta, Access, References, Namespace };
