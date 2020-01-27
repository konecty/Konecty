import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';
import size from 'lodash/size';
import map from 'lodash/map';
import identity from 'lodash/identity';

/* Get system menu
	@param authTokenId
*/

Meteor.registerMethod('menu', 'withUser', function(request) {
	const list = {};

	const accessCache = {};

	const getAccess = documentName => {
		if (!accessCache[documentName]) {
			accessCache[documentName] = accessUtils.getAccessFor(documentName, this.user);
		}
		return accessCache[documentName];
	};

	const namespace = MetaObject.findOne({ _id: 'Namespace' });

	const accesses = [];

	MetaObject.find({ type: { $nin: ['namespace', 'access'] } }, { sort: { _id: 1 } }).forEach(function(metaObject) {
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

	MetaObject.find({ _id: { $in: accesses } }).forEach(function(metaObject) {
		metaObject.namespace = namespace.ns;

		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		list[metaObject._id] = metaObject;
	});

	return list;
});

Meteor.publish('MetaObjectsWithAccess', function() {
	if (!this.userId) {
		return this.ready();
	}

	const user = Meteor.users.findOne(this.userId);

	const accessCache = {};

	const getAccess = documentName => {
		if (!accessCache[documentName]) {
			accessCache[documentName] = accessUtils.getAccessFor(documentName, user);
		}
		return accessCache[documentName];
	};

	const namespace = MetaObject.findOne({ _id: 'Namespace' });

	const processMetaObject = function(metaObject) {
		if (!metaObject.menuSorter) {
			metaObject.menuSorter = 999;
		}
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
			metaObject.accessId = access._id;
		}

		return metaObject;
	};

	const fields = {
		namespace: 1,
		document: 1,
		type: 1,
		name: 1,
		label: 1,
		plurals: 1,
		icon: 1,
		menuSorter: 1,
		group: 1
	};

	const self = this;

	MetaObject.find({ type: { $nin: ['namespace', 'access'] } }, { sort: { _id: 1 } }).observe({
		added(metaObject) {
			self.added('Menu', metaObject._id, processMetaObject(metaObject));
		},

		changed(metaObject) {
			self.changed('Menu', metaObject._id, processMetaObject(metaObject));
		},

		removed(metaObject) {
			self.removed('Menu', metaObject._id, processMetaObject(metaObject));
		}
	});

	self.ready();
});

Meteor.registerMethod('documents', 'withUser', function() {
	const { user } = this;

	const documents = Array.from(MetaObject.find({ type: 'document' }, { sort: { menuSorter: 1 } })).reduce(
		(acc, { _id, name, menuSorter, label, plurals }) => {
			const access = accessUtils.getAccessFor(name, user);

			if (access) {
				return [...acc, { _id, name, menuSorter, label, plurals }];
			}
			return acc;
		},
		[]
	);

	return documents;
});

Meteor.registerMethod('document', 'withUser', function({ document: documentId }) {
	const { user } = this;

	const [document] = Array.from(MetaObject.find({ _id: documentId, type: 'document' }, { limit: 1 }));

	if (document) {
		const { _id, name, label, plurals, fields } = document;
		return {
			_id,
			name,
			label,
			plurals,
			fields: map(fields, identity)
		};
	}
	return null;
});
