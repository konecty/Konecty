import BluebirdPromise from 'bluebird';

import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';

import debounce from 'lodash/debounce';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import unset from 'lodash/unset';

import { Document } from '@imports/model/Document';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectType } from '@imports/types/metadata';
import { checkInitialData } from '../data/initialData';
import { db } from '../database';
import { MetaAccess } from '../model/MetaAccess';
import { logger } from '../utils/logger';
import buildReferences from './buildReferences';

const rebuildReferencesDelay = 1000;

const dropAllIndexes = false;

const rebuildReferences = debounce(function () {
	logger.info('[kondata] Rebuilding references');

	MetaObject.References = buildReferences(MetaObject.Meta);
}, rebuildReferencesDelay);

async function tryEnsureIndex({ collection, fields, options }: { collection: (typeof MetaObject.Collections)[string]; fields: { [key: string]: 1 }; options: { name: string } }) {
	try {
		await collection.createIndex(fields, options);
	} catch (e) {
		logger.trace('Index Error: ', e);
	}
}

async function registerMeta(meta: MetaObjectType) {
	if (meta.type !== 'composite' && meta.type !== 'document') {
		return;
	}

	logger.debug(`Registering meta: ${meta.name}`);

	if (!meta.collection) {
		meta.collection = `data.${meta.name}`;
	}

	MetaObject.Meta[meta.name] = meta as Document;
	MetaObject.MetaByCollection[meta.collection] = meta;

	if (meta.type === 'document') {
		meta.fields['_merge'] = {
			name: '_merge',
			type: 'text',
			isList: true,
		};
	}

	if (MetaObject.Collections[meta.name] == null) {
		MetaObject.Collections[meta.name] = db.collection(`${meta.collection ?? meta.name}`);
		MetaObject.Collections[`${meta.name}.Comment`] = db.collection(`${meta.collection ?? meta.name}.Comment`);
		MetaObject.Collections[`${meta.name}.History`] = db.collection(`${meta.collection ?? meta.name}.History`);
		MetaObject.Collections[`${meta.name}.Trash`] = db.collection(`${meta.collection ?? meta.name}.Trash`);
		MetaObject.Collections[`${meta.name}.AutoNumber`] = db.collection(`${meta.collection ?? meta.name}.AutoNumber`);

		const processIndexes = async function () {
			// Drop all indexes of meta
			if (dropAllIndexes) {
				await MetaObject.Collections[meta.name].dropIndexes();
				await MetaObject.Collections[`${meta.name}.Comment`].dropIndexes();
				await MetaObject.Collections[`${meta.name}.History`].dropIndexes();
			}

			// Create indexes for history collections
			const historyIndexes = ['dataId', 'createdAt'];
			await BluebirdPromise.each(historyIndexes, async historyIndex => {
				await tryEnsureIndex({
					collection: MetaObject.Collections[`${meta.name}.History`],
					fields: { [historyIndex]: 1 },
					options: { name: historyIndex },
				});
			});

			// Create indexes for comment collections
			const commentIndexes = ['dataId', '_createdAt'];
			await BluebirdPromise.each(commentIndexes, async commentIndex => {
				await tryEnsureIndex({
					collection: MetaObject.Collections[`${meta.name}.Comment`],
					fields: { [commentIndex]: 1 },
					options: { name: commentIndex },
				});
			});

			const iterableMeta = Object.keys(meta.fields).map((key: string) => key);

			await BluebirdPromise.each(iterableMeta, async (fieldName: string) => {
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

						const options: {
							unique: number;
							name: string;
							sparse?: number;
						} = {
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

						const fields = subFields.reduce((acc, subField) => {
							acc[fieldName + subField] = 1;
							return acc;
						}, {} as any);

						logger.info(`Ensure Index at ${meta.collection}: ${fieldName}`);
						await tryEnsureIndex({
							collection: MetaObject.Collections[meta.name],
							fields,
							options,
						});
					}
				}
			});

			// Create indexes for internal fields
			const metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id'];

			await BluebirdPromise.each(metaDefaultIndexes, async metaDefaultIndex =>
				tryEnsureIndex({
					collection: MetaObject.Collections[meta.name],
					fields: { [metaDefaultIndex]: 1 },
					options: { name: metaDefaultIndex },
				}),
			);

			// Create indexes defined in meta
			if (meta.indexes != null && isObject(meta.indexes) && !isArray(meta.indexes) && Object.keys(meta.indexes).length > 0) {
				await BluebirdPromise.each(Object.keys(meta.indexes), async indexName => {
					let index = meta.indexes?.[indexName];

					if (index == null) {
						index = {
							keys: {},
							options: {
								name: indexName,
							},
						};
					}

					if (index.keys == null) {
						index.keys = {};
					}
					if (index.options == null) {
						index.options = {};
					}
					if (index.options.name == null) {
						index.options.name = indexName;
					}

					logger.info(`Ensure Index at ${meta.collection}: ${index.options.name}`);
					if (Object.keys(index.keys).length > 0) {
						const keys = Object.entries(index.keys).reduce((acc, [key, direction]) => {
							acc[key.replace(/:/g, '.')] = direction;
							return acc;
						}, {} as any);

						await tryEnsureIndex({
							collection: MetaObject.Collections[meta.name],
							fields: keys,
							options: { name: index.options.name },
						});
					}
				});
			}

			// Create text index
			if (meta.indexText != null && isObject(meta.indexText) && !isArray(meta.indexText) && Object.keys(meta.indexText).length > 0) {
				const options: {
					name: string;
					default_language: string;
					weights: Record<string, number>;
				} = {
					name: 'TextIndex',
					default_language: MetaObject.Namespace.language,
					weights: {},
				};

				logger.info(`Ensure Index at ${meta.collection}: ${options.name}`);

				const keys = Object.entries(meta.indexText).reduce((acc, [key, weight]) => {
					acc[key.replace(/:/g, '.')] = 'text';
					if (isNumber(weight) && weight > 0) {
						options.weights[key.replace(/:/g, '.')] = weight;
					}
					return acc;
				}, {} as any);

				await tryEnsureIndex({
					collection: MetaObject.Collections[meta.name],
					fields: keys,
					options,
				});
			}
		};

		if (isEmpty(process.env.DISABLE_REINDEX) || process.env.DISABLE_REINDEX === 'false' || process.env.DISABLE_REINDEX === '0') {
			processIndexes().catch(e => {
				logger.error(e, `Error creating indexes for ${meta.name}`);
			});
		}
	}
}

const deregisterMeta = function (meta: any) {
	unset(MetaObject.MetaByCollection, meta.collection ?? meta.name);
	unset(MetaObject.Meta, meta.name);
	unset(MetaObject.Collections, meta.name);
	unset(MetaObject.Collections, `${meta.name}.Comment`);
	unset(MetaObject.Collections, `${meta.name}.History`);
	unset(MetaObject.Collections, `${meta.name}.Trash`);
	unset(MetaObject.Collections, `${meta.name}.AutoNumber`);
};

async function dbLoad() {
	const data = await MetaObject.MetaObject.find<MetaObjectType>({}).toArray();
	data.forEach(async meta => {
		switch (meta.type) {
			case 'access':
				MetaObject.Access[meta._id as unknown as string] = meta as unknown as MetaAccess;
				break;
			case 'document':
			case 'composite':
				await registerMeta(meta);
				break;
			case 'pivot':
			case 'view':
			case 'list':
				MetaObject.DisplayMeta[meta._id as unknown as string] = meta;
				break;
		}
	});

	rebuildReferences();
	const namespace = await MetaObject.MetaObject.findOne({ type: 'namespace' });
	Object.assign(MetaObject.Namespace, namespace);
}

function dbWatch() {
	MetaObject.MetaObject.watch().on('change', async (change: any) => {
		if (change.operationType === 'delete') {
			switch (change.fullDocumentBeforeChange.type) {
				case 'access':
					unset(MetaObject.Access, change.fullDocumentBeforeChange._id);
					break;
				case 'document':
				case 'composite':
					deregisterMeta(change.fullDocumentBeforeChange);
					break;
				case 'pivot':
				case 'view':
				case 'list':
					unset(MetaObject.DisplayMeta, change.fullDocumentBeforeChange._id);
					break;
			}
		} else if (change.operationType === 'insert') {
			switch (change.fullDocument.type) {
				case 'access':
					MetaObject.Access[change.fullDocument._id] = change.fullDocument;
					break;
				case 'document':
				case 'composite':
					await registerMeta(change.fullDocument);
					break;
				case 'pivot':
				case 'view':
				case 'list':
					MetaObject.DisplayMeta[change.fullDocument._id] = change.fullDocument;
					break;
			}
		} else if (change.operationType === 'update') {
			const fullDocument = await MetaObject.MetaObject.findOne({ _id: change.documentKey._id });
			switch (fullDocument?.type) {
				case 'access':
					MetaObject.Access[fullDocument?._id as unknown as string] = fullDocument as unknown as MetaAccess;
					break;
				case 'document':
				case 'composite':
					await registerMeta(fullDocument as unknown as MetaObjectType);
					break;
				case 'pivot':
				case 'view':
				case 'list':
					MetaObject.DisplayMeta[fullDocument._id as unknown as string] = fullDocument;
					break;
			}
		}
		rebuildReferences();
	});
}


const fsLoad = (metadataDir: string) => {
	logger.info(`Loading MetaObject.Meta from directory ${metadataDir} ...`);

	const watcher = chokidar.watch(metadataDir, {
		ignored: /(^|[/\\])\../, // ignore dotfiles
		persistent: true,
	});

	const documentName = (path: string) =>
		path
			.replace(metadataDir, '')
			.replace(/^\/|\/$/g, '')
			.split('/')
			.shift();
	const fileType = (path: string) => {
		if (/.+document.json$/.test(path)) {
			return 'document';
		}
		return path.split('/').slice(-2).shift();
	};

	const getDocumentData = (path: string) => {
		const type = fileType(path);
		if (type === 'document') {
			return JSON.parse(fs.readFileSync(path, 'utf8'));
		}
		const documentFile = `${metadataDir}/${documentName(path)}/document.json`;
		if (fs.existsSync(documentFile)) {
			return JSON.parse(fs.readFileSync(documentFile, 'utf8'));
		}
		return null;
	};

	const changeHandler = async (path: string) => {
		const type = fileType(path);

		if (type != null && ['document', 'hook'].includes(type)) {
			const meta = getDocumentData(path);
			if (meta == null) {
				return;
			}
			const hooksDir = path.replace(/document.json$/, 'hook');
			if (fs.existsSync(hooksDir)) {
				glob.sync(hooksDir + '/*.js').forEach(file => {
					const hookName = file.split('/').pop()?.split('.').shift();
					const hook = fs.readFileSync(file, 'utf8');

					if (hookName != null) {
						meta[hookName] = hook;
					}
				});
				glob.sync(hooksDir + '/*.json').forEach(file => {
					const hookName = file.split('/').pop()?.split('.').shift();
					const hook = JSON.parse(fs.readFileSync(file, 'utf8'));
					if (hookName != null) {
						meta[hookName] = hook;
					}
				});
			}
			await registerMeta(meta);
			return rebuildReferences();
		}

		if (type === 'access') {
			const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
			MetaObject.Access[meta._id] = meta;
			return;
		}

		if (type != null && ['pivot', 'view', 'list'].includes(type)) {
			const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
			MetaObject.DisplayMeta[meta._id] = meta;
			return;
		}
	};

	const removeHandler = async (path: string) => {
		const type = fileType(path);
		const name = documentName(path);
		if (type != null && ['document'].includes(type)) {
			deregisterMeta({ name });
			return rebuildReferences();
		}

		if (type === 'hook') {
			return await changeHandler(`${metadataDir}/${name}/document.json`);
		}

		if (type === 'access') {
			const accessName = path.split('/').pop()?.split('.').shift();
			const id = `${name}:access:${accessName}`;
			delete MetaObject.Access[id];
		}
		if (type != null && ['pivot', 'view', 'list'].includes(type)) {
			const typeName = path.split('/').pop()?.split('.').shift();
			delete MetaObject.DisplayMeta[`${name}:${type}:${typeName}`];
		}
	};

	watcher
		.on('add', changeHandler)
		.on('change', changeHandler)
		.on('unlink', path => removeHandler(path));
};

export async function loadMetaObjects() {
	await checkInitialData();
	if (process.env.METADATA_DIR != null) {
		logger.info('Loading MetaObject.Meta from directory');
		return fsLoad(process.env.METADATA_DIR);
	}
	logger.info('Loading MetaObject.Meta from database');
	await dbLoad();
	if (MetaObject.Namespace?.plan?.useExternalKonsistent) {
		dbWatch();
	}
}
