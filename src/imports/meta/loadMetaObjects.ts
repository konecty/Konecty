import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';

import debounce from 'lodash/debounce';
import unset from 'lodash/unset';

import { Document } from '@imports/model/Document';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectType } from '@imports/types/metadata';
import { Promise as BluebirdPromise } from 'bluebird';
import { checkInitialData } from '../data/initialData';
import { db } from '../database';
import { MetaAccess } from '../model/MetaAccess';
import { logger } from '../utils/logger';
import applyIndexes from './applyIndexes';
import buildReferences from './buildReferences';

const rebuildReferencesDelay = 1000;

const rebuildReferences = debounce(function () {
	logger.info('[kondata] Rebuilding references');

	MetaObject.References = buildReferences(MetaObject.Meta);
}, rebuildReferencesDelay);

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
	}

	await applyIndexes(meta);
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
	await BluebirdPromise.all(data.map(async meta => {
		switch (meta.type) {
			case 'access':
				MetaObject.Access[meta._id as unknown as string] = meta as unknown as MetaAccess;
				break;
			case 'document':
			case 'composite':
				return registerMeta(meta);
			case 'pivot':
			case 'view':
			case 'list':
				MetaObject.DisplayMeta[meta._id as unknown as string] = meta;
				break;
		}
	}));

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
