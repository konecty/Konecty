import { Meteor } from 'meteor/meteor';

import chokidar from 'chokidar';
import glob from 'glob';
import fs from 'fs';

import debounce from 'lodash/debounce';
import isEmpty from 'lodash/isEmpty';
import bind from 'lodash/bind';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import isNumber from 'lodash/isNumber';

import { registerFirstUser, registerFirstGroup } from './initialData';

import { MetaObject, Meta, DisplayMeta, Access, References, Namespace, Models, MetaByCollection } from '/imports/model/MetaObject';
import { logger } from '/imports/utils/logger';

const rebuildReferencesDelay = 1000;

const dropAllIndexes = false;
const overwriteExitingIndexes = false;
const logIndexActionEnable = false;

const logIndexAction = function (msg) {
	if (logIndexActionEnable === true) {
		console.log(msg);
	}
};

const getIndexes = function (collectionName) {
	const collection = Models[collectionName]._getCollection();
	const indexInformation = Meteor.wrapAsync(bind(collection.indexInformation, collection));
	return indexInformation();
};

const rebuildReferences = debounce(function () {
	console.log('[kondata] Rebuilding references');
	References = {};

	for (var metaName in Meta) {
		var meta = Meta[metaName];
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
}, rebuildReferencesDelay);

const tryEnsureIndex = function (model, fields, options) {
	try {
		model._ensureIndex(fields, options);
	} catch (e) {
		if (overwriteExitingIndexes && e.toString().indexOf('already exists with different options') !== -1) {
			logIndexAction(`Overwriting index: ${JSON.stringify(fields)}`.yellow);
			model._dropIndex(fields);
			model._ensureIndex(fields, options);
		} else if (e.toString().indexOf('too many indexes for') !== -1) {
			logIndexAction('Too many indexes');
		} else {
			logIndexAction('Index Error: ', e);
		}
	}
};

const initialData = debounce(
	Meteor.bindEnvironment(function () {
		registerFirstUser();
		registerFirstGroup();
	}),
	2000,
);

const registerMeta = function (meta) {
	logger.debug(`Registering meta: ${meta.name}`);
	if (!meta.collection) {
		meta.collection = `data.${meta.name}`;
	}
	Meta[meta.name] = meta;
	
	MetaByCollection[meta.collection] = meta;

	if (meta.type === 'document') {
		meta.fields._merge = {
			name: '_merge',
			type: 'text',
			isList: true,
		};
	}

	if (!Models[meta.name]) {
		Models[`${meta.name}.Comment`] = new Meteor.Collection(`${meta.collection}.Comment`);
		Models[`${meta.name}.History`] = new Meteor.Collection(`${meta.collection}.History`);
		Models[`${meta.name}.Trash`] = new Meteor.Collection(`${meta.collection}.Trash`);
		Models[`${meta.name}.AutoNumber`] = new Meteor.Collection(`${meta.collection}.AutoNumber`);

		switch (meta.collection) {
			case 'users':
				Models[meta.name] = Meteor.users;
				break;
			default:
				Models[meta.name] = new Meteor.Collection(meta.collection);
		}

		const dropIndexes = function () {
			// Drop data indexes
			let indexInformation;
			let indexesInformation = getIndexes(meta.name);
			if (indexesInformation) {
				for (indexInformation in indexesInformation) {
					if (indexInformation !== '_id_') {
						logIndexAction(`Drop Index at ${meta.collection}: ${indexInformation}`);
						Models[meta.name]._dropIndex(indexInformation);
					}
				}
			}

			// Drop comment indexes
			indexesInformation = getIndexes(`${meta.name}.Comment`);
			if (indexesInformation) {
				for (indexInformation in indexesInformation) {
					if (indexInformation !== '_id_') {
						logIndexAction(`Drop Index at ${meta.collection}.Comment: ${indexInformation}`);
						Models[`${meta.name}.Comment`]._dropIndex(indexInformation);
					}
				}
			}

			// Drop history indexes
			indexesInformation = getIndexes(`${meta.name}.History`);
			if (indexesInformation) {
				for (indexInformation in indexesInformation) {
					if (indexInformation !== '_id_') {
						logIndexAction(`Drop Index at ${meta.collection}.History: ${indexInformation}`);
						Models[`${meta.name}.History`]._dropIndex(indexInformation);
					}
				}
			}
		};

		const processIndexes = function () {
			// Drop all indexes of meta
			let fieldName, fields, key, keys, options;
			if (dropAllIndexes === true) {
				dropIndexes();
			}

			// Create index for TTL in ActiveSessions
			if (meta.name === 'ActiveSessions') {
				fieldName = 'expireAt';
				fields = {};
				fields[fieldName] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}: ${fieldName}`.green);
				tryEnsureIndex(Models[meta.name], fields, { name: fieldName, expireAfterSeconds: 60 });
			}

			// Create indexes for history collections
			const historyIndexes = ['dataId', 'createdAt'];
			for (let historyIndex of historyIndexes) {
				fields = {};
				fields[historyIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}.History: ${historyIndex}`.green);
				tryEnsureIndex(Models[`${meta.name}.History`], fields, { name: historyIndex });
			}

			// Create indexes for comment collections
			const commentIndexes = ['dataId', '_createdAt'];
			for (let commentIndex of commentIndexes) {
				fields = {};
				fields[commentIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}.Comment: ${commentIndex}`.green);
				tryEnsureIndex(Models[`${meta.name}.Comment`], fields, { name: commentIndex });
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

						logIndexAction(`Ensure Index at ${meta.collection}: ${fieldName}`.green);
						tryEnsureIndex(Models[meta.name], fields, options);
					}
				}
			}

			// Create indexes for internal fields
			const metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id'];
			for (let metaDefaultIndex of metaDefaultIndexes) {
				fields = {};
				fields[metaDefaultIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}: ${metaDefaultIndex}`.green);
				tryEnsureIndex(Models[meta.name], fields, { name: metaDefaultIndex });
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

					logIndexAction(`Ensure Index at ${meta.collection}: ${index.options.name}`.green);
					if (Object.keys(index.keys).length > 0) {
						keys = {};
						for (key in index.keys) {
							const direction = index.keys[key];
							keys[key.replace(/:/g, '.')] = direction;
						}

						tryEnsureIndex(Models[meta.name], keys, index.options);
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

				logIndexAction(`Ensure Index at ${meta.collection}: ${options.name}`.green);
				for (key in meta.indexText) {
					const weight = meta.indexText[key];
					key = key.replace(/:/g, '.');
					keys[key] = 'text';
					if (isNumber(weight) && weight > 0) {
						options.weights[key] = weight;
					}
				}

				tryEnsureIndex(Models[meta.name], keys, options);
			}
		};

		if (isEmpty(process.env.DISABLE_REINDEX) || process.env.DISABLE_REINDEX === 'false' || process.env.DISABLE_REINDEX === '0') {
			Meteor.defer(processIndexes);
		}
	}

	// wait required metas to create initial data
	if (Models['User'] && Models['Group']) {
		initialData();
	}
};

const deregisterMeta = function (meta) {
	delete Meta[meta.name];

	delete Models[`${meta.name}.Comment`];
	delete Models[`${meta.name}.History`];
	delete Models[`${meta.name}.Trash`];
	delete Models[`${meta.name}.AutoNumber`];
	delete Models[meta.name];
};

const dbLoad = () => {
	MetaObject.find({ type: 'access' }).observe({
		added(meta) {
			Access[meta._id] = meta;
		},

		changed(meta) {
			Access[meta._id] = meta;
		},

		removed(meta) {
			delete Access[meta._id];
		},
	});

	MetaObject.find({ type: { $in: ['document', 'composite'] } }).observe({
		added(meta) {
			registerMeta(meta);
			rebuildReferences();
		},

		changed(meta) {
			registerMeta(meta);
			rebuildReferences();
		},

		removed(meta) {
			deregisterMeta(meta);
			rebuildReferences();
		},
	});

	MetaObject.find({ type: { $in: ['pivot', 'view', 'list'] } }).observe({
		added(meta) {
			DisplayMeta[meta._id] = meta;
		},

		changed(meta) {
			DisplayMeta[meta._id] = meta;
		},

		removed(meta) {
			delete DisplayMeta[meta._id];
		},
	});
};

const fsLoad = () => {
	console.log(`Loading Meta from directory ${process.env.METADATA_DIR} ...`);

	const watcher = chokidar.watch(process.env.METADATA_DIR, {
		ignored: /(^|[\/\\])\../, // ignore dotfiles
		persistent: true,
	});
	const documentName = path =>
		path
			.replace(process.env.METADATA_DIR, '')
			.replace(/^\/|\/$/g, '')
			.split('/')
			.shift();
	const fileType = path => {
		if (/.+document.json$/.test(path)) {
			return 'document';
		}
		return path.split('/').slice(-2).shift();
	};

	const getDocumentData = path => {
		const type = fileType(path);
		if (type === 'document') {
			return JSON.parse(fs.readFileSync(path, 'utf8'));
		}
		const documentFile = `${process.env.METADATA_DIR}/${documentName(path)}/document.json`;
		if (fs.existsSync(documentFile)) {
			return JSON.parse(fs.readFileSync(documentFile, 'utf8'));
		}
		return null;
	};

	const changeHandler = path => {
		const type = fileType(path);
		if (['document', 'hook'].includes(type)) {
			const meta = getDocumentData(path);
			if (meta == null) {
				return;
			}
			const hooksDir = path.replace(/document.json$/, 'hook');
			if (fs.existsSync(hooksDir)) {
				glob.sync(hooksDir + '/*.js').forEach(file => {
					const hookName = file.split('/').pop().split('.').shift();
					const hook = fs.readFileSync(file, 'utf8');
					meta[hookName] = hook;
				});
				glob.sync(hooksDir + '/*.json').forEach(file => {
					const hookName = file.split('/').pop().split('.').shift();
					const hook = JSON.parse(fs.readFileSync(file, 'utf8'));
					meta[hookName] = hook;
				});
			}
			registerMeta(meta);
			return rebuildReferences();
		}

		if (type === 'access') {
			const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
			Access[meta._id] = meta;
			return;
		}

		if (['pivot', 'view', 'list'].includes(type)) {
			const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
			DisplayMeta[meta._id] = meta;
			return;
		}
	};

	const removeHandler = path => {
		const type = fileType(path);
		const name = documentName(path);
		if (['document'].includes(type)) {
			deregisterMeta({ name });
			return rebuildReferences();
		}

		if (type === 'hook') {
			return changeHandler(`${process.env.METADATA_DIR}/${name}/document.json`);
		}

		if (type === 'access') {
			const accessName = path.split('/').pop().split('.').shift();
			const id = `${name}:access:${accessName}`;
			console.log(id);
			delete Access[id];
		}
		if (['pivot', 'view', 'list'].includes(type)) {
			const typeName = path.split('/').pop().split('.').shift();
			delete DisplayMeta[`${name}:${type}:${typeName}`];
		}
	};
	watcher
		.on('add', changeHandler)
		.on('change', changeHandler)
		.on('unlink', path => removeHandler(path));
};

Meteor.startup(function () {
	if (process.env.METADATA_DIR != null) {
		logger.info('Loading Meta from directory');
		return fsLoad();
	}
	logger.info('Loading Meta from database');
	dbLoad();
});
