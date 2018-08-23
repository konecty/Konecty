/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { registerFirstUser, registerFirstGroup } from './initialData';

this.Meta = {};
this.DisplayMeta = {};
this.Access = {};
this.References = {};
this.Namespace = {};

const dropAllIndexes = false;
const overwriteExitingIndexes = false;
const logIndexActionEnable = false;

const logIndexAction = function(msg) {
	if (logIndexActionEnable === true) {
		return console.log(msg);
	}
};

const getIndexes = function(collectionName) {
	const collection = Models[collectionName]._getCollection();
	const indexInformation = Meteor.wrapAsync(_.bind(collection.indexInformation, collection));
	return indexInformation();
};

const rebuildReferences = function() {
	console.log('[kondata] Rebuilding references');
	global.References = {};

	return (() => {
		const result = [];
		for (var metaName in Meta) {
			var meta = Meta[metaName];
			result.push((() => {
				const result1 = [];
				for (let fieldName in meta.fields) {
					const field = meta.fields[fieldName];
					if (field.type === 'lookup') {
						if (References[field.document] == null) { References[field.document] = {from: {}}; }
						if (References[field.document].from[metaName] == null) { References[field.document].from[metaName] = {}; }
						result1.push(References[field.document].from[metaName][fieldName] = {
							type: field.type,
							field: fieldName,
							isList: field.isList,
							descriptionFields: field.descriptionFields,
							detailFields: field.detailFields
						});
					} else {
						result1.push(undefined);
					}
				}
				return result1;
			})());
		}
		return result;
	})();
};

const tryEnsureIndex = function(model, fields, options) {
	try {
		return model._ensureIndex(fields, options);
	} catch (e) {
		if (overwriteExitingIndexes && (e.toString().indexOf('already exists with different options') !== -1)) {
			logIndexAction(`Overwriting index: ${JSON.stringify(fields)}`.yellow);
			model._dropIndex(fields);
			return model._ensureIndex(fields, options);
		} else {
			return console.log('Index Error: '.red, e);
		}
	}
};

const initialData = _.debounce(Meteor.bindEnvironment( function() {
	registerFirstUser();
	return registerFirstGroup();
}), 2000);

const registerMeta = function(meta) {
	if (meta.collection == null) { meta.collection = `data.${meta.name}`; }
	Meta[meta.name] = meta;

	if (meta.type === 'document') {
		meta.fields._merge = {
			name: '_merge',
			type: 'text',
			isList: true
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

		Meteor.publish(`data.${meta.name}`, function(filter, limit) {
			if (this.userId == null) { return this.ready(); }

			if (!filter) {
				filter = {};
			}
			return Models[meta.name].find(filter, {limit: limit || 30});
	});

		// Meteor.publish "data.#{meta.name}.History", (limit) ->
		// 	return @ready() unless @userId?
		// 	return Models["#{meta.name}.History"].find {}, {limit: limit or 30}

		Meteor.publish(`data.${meta.name}.History`, function(filter, limit) {
			if (this.userId == null) { return this.ready(); }

			if (!filter) {
				filter = {};
			}
			return Models[`${meta.name}.History`].find(filter, {limit: limit || 30});
	});

		const dropIndexes = function() {
			// Drop data indexes
			let indexInformation, value;
			let indexesInformation = getIndexes(meta.name);
			if (indexesInformation != null) {
				for (indexInformation in indexesInformation) {
					value = indexesInformation[indexInformation];
					if (indexInformation !== '_id_') {
						logIndexAction(`Drop Index at ${meta.collection}: ${indexInformation}`.red);
						Models[meta.name]._dropIndex(indexInformation);
					}
				}
			}

			// Drop comment indexes
			indexesInformation = getIndexes(`${meta.name}.Comment`);
			if (indexesInformation != null) {
				for (indexInformation in indexesInformation) {
					value = indexesInformation[indexInformation];
					if (indexInformation !== '_id_') {
						logIndexAction(`Drop Index at ${meta.collection}.Comment: ${indexInformation}`.red);
						Models[`${meta.name}.Comment`]._dropIndex(indexInformation);
					}
				}
			}

			// Drop history indexes
			indexesInformation = getIndexes(`${meta.name}.History`);
			if (indexesInformation != null) {
				return (() => {
					const result = [];
					for (indexInformation in indexesInformation) {
						value = indexesInformation[indexInformation];
						if (indexInformation !== '_id_') {
							logIndexAction(`Drop Index at ${meta.collection}.History: ${indexInformation}`.red);
							result.push(Models[`${meta.name}.History`]._dropIndex(indexInformation));
						}
					}
					return result;
				})();
			}
		};

		const processIndexes = function() {
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
				tryEnsureIndex(Models[meta.name], fields, {name: fieldName, expireAfterSeconds: 60});
			}

			// Create indexes for history collections
			const historyIndexes = ['dataId', 'createdAt'];
			for (let historyIndex of Array.from(historyIndexes)) {
				fields = {};
				fields[historyIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}.History: ${historyIndex}`.green);
				tryEnsureIndex(Models[`${meta.name}.History`], fields, {name: historyIndex});
			}

			// Create indexes for comment collections
			const commentIndexes = ['dataId', '_createdAt'];
			for (let commentIndex of Array.from(commentIndexes)) {
				fields = {};
				fields[commentIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}.Comment: ${commentIndex}`.green);
				tryEnsureIndex(Models[`${meta.name}.Comment`], fields, {name: commentIndex});
			}

			// Create indexes for each field that is sortable
			for (fieldName in meta.fields) {
				const field = meta.fields[fieldName];
				if (!['richText', 'composite'].includes(field.type)) {
					if ((field.isSortable === true) || (field.isUnique === true) || ['lookup', 'address', 'autoNumber'].includes(field.type)) {
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
							name: fieldName
						};

						if ((field.type === 'autoNumber') || (field.isUnique === true)) {
							options.unique = 1;
						}

						if ((field.isUnique === true) && (field.isRequired !== true)) {
							options.sparse = 1;
						}

						if (['username', 'emails'].includes(field.name) && (meta.name === 'User')) {
							options.unique = 1;
							options.sparse = 1;
						}

						fields = {};

						for (let subField of Array.from(subFields)) {
							fields[fieldName + subField] = 1;
						}

						logIndexAction(`Ensure Index at ${meta.collection}: ${fieldName}`.green);
						tryEnsureIndex(Models[meta.name], fields, options);
					}
				}
			}

			// Create indexes for internal fields
			const metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id'];
			for (let metaDefaultIndex of Array.from(metaDefaultIndexes)) {
				fields = {};
				fields[metaDefaultIndex] = 1;

				logIndexAction(`Ensure Index at ${meta.collection}: ${metaDefaultIndex}`.green);
				tryEnsureIndex(Models[meta.name], fields, {name: metaDefaultIndex});
			}

			// Create indexes defined in meta
			if (_.isObject(meta.indexes) && !_.isArray(meta.indexes) && (Object.keys(meta.indexes).length > 0)) {
				for (let indexName in meta.indexes) {
					const index = meta.indexes[indexName];
					if (index.keys == null) { index.keys = {}; }
					if (index.options == null) { index.options = {}; }
					if (index.options.name == null) { index.options.name = indexName; }

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
			if (_.isObject(meta.indexText) && !_.isArray(meta.indexText) && (Object.keys(meta.indexText).length > 0)) {
				keys = {};
				options = {
					name: 'TextIndex',
					default_language: global.Namespace.language,
					weights: {}
				};

				logIndexAction(`Ensure Index at ${meta.collection}: ${options.name}`.green);
				for (key in meta.indexText) {
					const weight = meta.indexText[key];
					key = key.replace(/:/g, '.');
					keys[key] = 'text';
					if (_.isNumber(weight) && (weight > 0)) {
						options.weights[key] = weight;
					}
				}

				return tryEnsureIndex(Models[meta.name], keys, options);
			}
		};

		Meteor.defer(processIndexes);
	}

	// wait required metas to create initial data
	if (Models['User'] && Models['Group']) {
		return initialData();
	}
};

const deregisterMeta = function(meta) {
	delete Meta[meta.name];

	delete Models[`${meta.name}.Comment`];
	delete Models[`${meta.name}.History`];
	delete Models[`${meta.name}.Trash`];
	delete Models[`${meta.name}.AutoNumber`];
	return delete Models[meta.name];
};

Meteor.startup(function() {
	if (!!process.env.IS_MIRROR === true) {
		MetaObject.remove({});
		Meteor.users.remove({});
	}

	MetaObject.find({type: 'access'}).observe({
		added(meta) {
			return Access[meta._id] = meta;
		},

		changed(meta) {
			return Access[meta._id] = meta;
		},

		removed(meta) {
			return delete Access[meta._id];
		}});


	let rebuildReferencesTimer = null;
	const rebuildReferencesDelay = 1000;

	MetaObject.find({type: {$in: ['document', 'composite']}}).observe({
		added(meta) {
			registerMeta(meta);

			clearTimeout(rebuildReferencesTimer);
			return rebuildReferencesTimer = setTimeout(rebuildReferences, rebuildReferencesDelay);
		},

		changed(meta) {
			registerMeta(meta);

			clearTimeout(rebuildReferencesTimer);
			return rebuildReferencesTimer = setTimeout(rebuildReferences, rebuildReferencesDelay);
		},

		removed(meta) {
			deregisterMeta(meta);

			clearTimeout(rebuildReferencesTimer);
			return rebuildReferencesTimer = setTimeout(rebuildReferences, rebuildReferencesDelay);
		}
	});


	return MetaObject.find({type: {$in: ['pivot', 'view', 'list']}}).observe({
		added(meta) {
			return DisplayMeta[meta._id] = meta;
		},

		changed(meta) {
			return DisplayMeta[meta._id] = meta;
		},

		removed(meta) {
			return delete DisplayMeta[meta._id];
		}});});

