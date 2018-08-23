/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/* Get system menu
	@param authTokenId
*/
Meteor.registerMethod('menu', 'withUser', function(request) {
	const list = {};

	const accessCache = {};

	const getAccess = documentName => {
		if ((accessCache[documentName] == null)) {
			accessCache[documentName] = accessUtils.getAccessFor(documentName, this.user);
		}
		return accessCache[documentName];
	};

	const namespace = MetaObject.findOne({_id: 'Namespace'});

	const accesses = [];

	MetaObject.find({type: {$nin: ['namespace', 'access']}}, {sort: {_id: 1}}).forEach(function(metaObject) {
		let value;
		metaObject.namespace = namespace.ns;

		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		let access = undefined;
		if (metaObject.document != null) {
			access = getAccess(metaObject.document);
		} else {
			access = getAccess(metaObject.name);
		}

		if ((access === false) && !['document', 'composite'].includes(metaObject.type)) {
			return;
		}

		if (['document', 'composite'].includes(metaObject.type) && _.isObject(access)) {
			accesses.push(access._id);
			metaObject.access = metaObject.namespace + ':' + access._id;
		}

		const columns = [];

		for (var key in metaObject.columns) {
			value = metaObject.columns[key];
			columns.push(value);
		}

		metaObject.columns = columns;

		if (metaObject.oldVisuals != null) {
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

		if (_.isArray(metaObject.fields)) {
			for (let field of Array.from(metaObject.fields)) {
				if ((field.type === 'lookup') && ((field.inheritedFields != null ? field.inheritedFields.length : undefined) > 0)) {
					field.type = 'inheritLookup';
				}
			}
		}

		return list[metaObject._id] = metaObject;
	});

	MetaObject.find({_id: {$in: accesses}}).forEach(function(metaObject) {
		metaObject.namespace = namespace.ns;

		metaObject._id = metaObject.namespace + ':' + metaObject._id;

		return list[metaObject._id] = metaObject;
	});

	return list;
});


Meteor.publish('MetaObjectsWithAccess', function() {
	if (this.userId == null) { return this.ready(); }

	const user = Meteor.users.findOne(this.userId);

	const accessCache = {};

	const getAccess = documentName => {
		if ((accessCache[documentName] == null)) {
			accessCache[documentName] = accessUtils.getAccessFor(documentName, user);
		}
		return accessCache[documentName];
	};

	const namespace = MetaObject.findOne({_id: 'Namespace'});


	const processMetaObject = function(metaObject) {
		if (metaObject.menuSorter == null) { metaObject.menuSorter = 999; }
		let access = undefined;
		if (metaObject.document != null) {
			access = getAccess(metaObject.document);
		} else {
			access = getAccess(metaObject.name);
		}

		if ((access === false) && !['document', 'composite'].includes(metaObject.type)) {
			return;
		}

		if (['document', 'composite'].includes(metaObject.type) && _.isObject(access)) {
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

	MetaObject.find({type: {$nin: ['namespace', 'access']}}, {sort: {_id: 1}}).observe({
		added(metaObject) {
			return self.added('Menu', metaObject._id, processMetaObject(metaObject));
		},

		changed(metaObject) {
			return self.changed('Menu', metaObject._id, processMetaObject(metaObject));
		},

		removed(metaObject) {
			return self.removed('Menu', metaObject._id, processMetaObject(metaObject));
		}
	});


	return self.ready();
});
