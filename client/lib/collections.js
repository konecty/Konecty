/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Menu = new Meteor.Collection('Menu');

const processViewMappings = function(doc) {
	let group;
	doc.groupsMap = {};
	if (doc.groups != null) {
		for (group of Array.from(doc.groups)) {
			group.visuals = [];
			group.visualsMap = {};
			doc.groupsMap[group.name] = group;
		}
	}

	doc.visualsMap = {};
	if (doc.visuals != null) {
		return (() => {
			const result = [];
			for (let visual of Array.from(doc.visuals)) {
				doc.visualsMap[visual.name] = visual;
				if (doc.groupsMap[visual.group] != null) {
					doc.groupsMap[visual.group].visuals.push(visual);
					result.push(doc.groupsMap[visual.group].visualsMap[visual.name] = visual);
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	}
};

const processListMappings = function(doc) {
	doc.columnsMap = doc.columns;
	doc.columns = [];
	if (doc.columnsMap != null) {
		return (() => {
			const result = [];
			for (let key in doc.columnsMap) {
				const column = doc.columnsMap[key];
				result.push(doc.columns.push(column));
			}
			return result;
		})();
	}
};

this.Menu.find().observe({
	added(doc) {
		if (doc.type === 'view') {
			processViewMappings(Menu._collection._docs._map[doc._id]);
		}
		if (doc.type === 'list') {
			return processListMappings(Menu._collection._docs._map[doc._id]);
		}
	},
	changed(doc) {
		if (doc.type === 'view') {
			processViewMappings(Menu._collection._docs._map[doc._id]);
		}
		if (doc.type === 'list') {
			return processListMappings(Menu._collection._docs._map[doc._id]);
		}
	}});