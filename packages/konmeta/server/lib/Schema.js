import { DeepExtend, convertObjectIdsToFn } from './utils';

import Db from './Db';

import coreNamespace from '../model/coreNamespace';
import coreMetaObject from '../model/coreMetaObject';
import MetaObjects from '../model/MetaObjects';

async function fetchNamespaces(namespaceObject) {
	let namespaces = [namespaceObject._id];

	if (!namespaceObject.parents) {
		return namespaces;
	}

	let cursor;

	if (process.env.KONMETA_DB_URL) {
		const db = await Db.getConnection();
		cursor = await db.collection('Namespace').find({_id: {$in: namespaceObject.parents}}).toArray();
	} else {
		cursor = coreNamespace.find({_id: {$in: namespaceObject.parents}}).fetch();
	}
	await Promise.all(cursor.map(async parent => {
		const cursor = await fetchNamespaces(parent);

		cursor.forEach(namespace => {
			if (namespaces.indexOf(namespace) === -1) {
				namespaces.push(namespace);
			}
		});
	}));

	return namespaces;
}

async function getMetaObjects(namespaces) {
	if (process.env.KONMETA_DB_URL) {
		console.log('[konmeta] Searchin Meta Objects from ➜'.green, process.env.KONMETA_DB_URL);
		const db = await Db.getConnection();
		return await db.collection('MetaObject').find({namespace: {$in: namespaces}}).toArray();
	} else {
		console.log('[konmeta] Searchin Metaobjects from Core.namespace ➜'.green, process.env.MONGO_URL);
		return coreMetaObject.find({namespace: {$in: namespaces}}).fetch();
	}
}

export default new class Schema {
	namespaceHierarchy = {};

	async processNamespaceHierarchy(namespaceObject) {
		console.log('[konmeta] Processing Namespace Hierarchy ➜'.green, namespaceObject._id.cyan);

		const namespaces = await fetchNamespaces(namespaceObject);
		const metaObjects = this.parseMetaObjects(await getMetaObjects(namespaces));
		
		this.namespaceHierarchy[namespaceObject._id] = namespaces;

		for (let key in metaObjects) {
			const metaObject = metaObjects[key];
			const lastMetaObject = {
				_id: key,
				namespace: []
			};

			const metasToMerge = [];
			for (let index = 0; index < namespaces.length; index++) {
				const namespace = namespaces[index];
				if (metaObject[namespace] != null) {
					metasToMerge.push(this.process(metaObject[namespace], (index+1) !== namespaces.length));
					lastMetaObject.namespace.push(namespace);
				}
			}
			
			if ((metasToMerge.length > 1) && !['document', 'composite'].includes(metasToMerge[0].type)) {
				for (let i = metasToMerge.length - 1; i > 0; i--) {
					const metaToMerge = metasToMerge[i]
					delete metaToMerge.visuals;
				}
			}

			metasToMerge.push(lastMetaObject);
			const flatMetaObject = DeepExtend.apply(DeepExtend, metasToMerge);

			console.log('[konmeta] Using Namespace(s) ' + JSON.stringify(flatMetaObject.namespace) + ' for ' + flatMetaObject._id);

			if (namespaceObject._id === 'foxter' && flatMetaObject._id === 'Product:access:Default') {
				if (flatMetaObject.fields && flatMetaObject.fields.supplier && flatMetaObject.fields.supplier.READ &&
					flatMetaObject.fields.supplier.READ.condition && flatMetaObject.fields.supplier.READ.condition.operator === 'contains') {
					flatMetaObject.fields.supplier.READ.condition.operator = 'equals';
				}
				if (flatMetaObject.fields && flatMetaObject.fields.privateFile && flatMetaObject.fields.privateFile.READ &&
					flatMetaObject.fields.privateFile.READ.condition && flatMetaObject.fields.privateFile.READ.condition.operator === 'contains') {
					flatMetaObject.fields.privateFile.READ.condition.operator = 'equals';
				}
			}

			this.saveFlat(namespaceObject, flatMetaObject);		
		}
		const toDelete = [];
		MetaObjects.find({}, { fields: { _id: 1 }}).forEach(doc => {
			if ((metaObjects[doc._id] == null)) {
				toDelete.push(doc._id);
			}
		});
		if (toDelete.length > 0) {
			MetaObjects.remove({_id: {$in: toDelete}, type: {$ne: 'namespace'}});
		}
	}

	copyNamespace(namespaceObject) {
		console.log('[konmeta] Copying Namespace ➜'.green, namespaceObject._id.cyan);
		const baseObject = {
			_id: null,
			active: false,
			locale: null,
			logoURL: null,
			name: null,
			onCreate: null,
			onUpdate: null,
			sendAlertEmail: false,
			siteURL: null,
			status: null,
			trackUserGeolocation: false,
			watermark: null
		};

		const defaultObject = {
			_id: 'Namespace',
			type: 'namespace',
			ns: namespaceObject._id
		};

		const namespace = DeepExtend(baseObject, namespaceObject, defaultObject);

		return this.saveFlat(namespaceObject, namespace);
	}

	parseMetaObjects(metaObjects) {
		const ids = {};

		metaObjects.forEach(metaObject => {
			let key;
			if (metaObject.document != null) {
				key = `${metaObject.document}:${metaObject.type}:${metaObject.name}`;
			} else {
				key = metaObject.name;
			}

			if (ids[key] == null) {
				ids[key] = {};
			}
			ids[key][metaObject.namespace] = metaObject;
		});

		return ids;
	}

	process(oldSchema, addInherited) {
		let columns;
		delete oldSchema.refs;

		if (_.isArray(oldSchema.columns)) {
			oldSchema.columns.forEach(function(column) {
				// Add for compatibility with RIA
				if (addInherited === true) {
					column.isInherited = true;
				}
			});
		}

		if (_.isArray(oldSchema.fields)) {
			const fields = {};

			oldSchema.fields.forEach(function(field, index) {

				if (field.minElements != null) { field.minItems = field.minElements; }
				if (field.maxElements != null) { field.maxItems = field.maxElements; }
				delete field.minElements;
				delete field.maxElements;

				if (field.type === 'inheritLookup') {
					field.type = 'lookup';
				}

				let options = undefined;
				if (_.isArray(field.options)) {
					options = {};
					field.options.forEach(function(option) {
						let optionKey = option.key || option.pt_BR || option.en;
						if (optionKey.indexOf('.') !== -1) {
							const oldOptionKey = optionKey;
							optionKey = optionKey.replace(/\./g, '-');
							console.log(`[konmeta] Invalid option key: ${oldOptionKey}. Replacing it with: ${optionKey}`);
						}
						options[optionKey] = option;
					});
				}

				if (options != null) { field.options = options; }

				// if fieldTypes[field.type]?
				// 	_.extend field, fieldTypes[field.type]
				// else
				// 	return

				// Add for compatibility with RIA
				if (addInherited === true) {
					field.isInherited = true;
				}

				fields[field.name] = field;
			});

			oldSchema.fields = fields;
		}

		if (_.isArray(oldSchema.columns)) {
			columns = {};

			oldSchema.columns.forEach(function(column, index) {
				// Add for compatibility with RIA
				if (addInherited === true) {
					column.isInherited = true;
				}

				columns[column.name] = column;
			});

			oldSchema.columns = columns;
		}

		if ((oldSchema.type === 'view') && (oldSchema.version === 2) && _.isArray(oldSchema.groups) && (oldSchema.groups.length > 0)) {
			const visuals = [];

			for (let i = 0, len = oldSchema.groups.length; i < len; i++) {
				const group = oldSchema.groups[i];
				const visualItem = {
					type: 'visualGroup',
					style: {
						icon: group.icon
					},
					label: group.label,
					visuals: []
				};

				visuals.push(visualItem);

				for (let i = 0, len = oldSchema.visuals.length; i < len; i++) {
					const visual = oldSchema.visuals[i];
					if (visual.group === group.name) {
						const v = {
							type: 'visualSymlink',
							fieldName: visual.name,
							style: {}
						};

						if (visual.defaultValue != null) {
							v.defaultValue = visual.defaultValue;
						}

						if (visual.height != null) { v.style.height = visual.height; }
						if (visual.multiLine != null) { v.style.multiLine = visual.multiLine; }
						if (visual.columns != null) { v.style.columns = visual.columns; }
						if (visual.readOnly != null) { v.style.readOnlyVersion = visual.readOnly; }
						if (visual.renderAs != null) { v.style.renderAs = visual.renderAs; }
						if (visual.list != null) { v.style.listViewName = visual.list; }
						if (visual.view != null) { v.style.linkedFormName = visual.view; }
						if (visual.view != null) { v.style.viewId = visual.view; }

						visualItem.visuals.push(v);
					}
				}
			}

			oldSchema.oldVisuals = [{
				type: 'visualGroup',
				style: {
					title: 'Formulário'
				},
				visuals
			}
			];

			if (oldSchema.reverseLookups != null) {
				for (let i = 0, len = oldSchema.reverseLookups.length; i < len; i++) {
					const reverseLookup = oldSchema.reverseLookups[i];

					oldSchema.oldVisuals.push({
						type: 'reverseLookup',
						field: reverseLookup.field,
						document: reverseLookup.document,
						list: reverseLookup.list,
						style: {
							title: reverseLookup.label
						}
					});
				}
			}
		}

		return oldSchema;
	}

	saveFlat(namespace, schema) {
		const newSchema = convertObjectIdsToFn(schema, value => db.bson_serializer.ObjectID(value));
		MetaObjects.upsert({ _id: schema._id }, schema);
	}
}
