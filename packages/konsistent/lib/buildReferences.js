/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.buildReferences = function(Meta) {
	const References = {};

	for (let metaName in Meta) {
		const meta = Meta[metaName];
		for (let fieldName in meta.fields) {
			const field = meta.fields[fieldName];
			if (field.type === 'lookup') {
				if (References[field.document] == null) { References[field.document] = {}; }
				if (References[field.document].from == null) { References[field.document].from = {}; }
				if (References[field.document].from[metaName] == null) { References[field.document].from[metaName] = {}; }
				References[field.document].from[metaName][fieldName] = {
					type: field.type,
					field: fieldName,
					isList: field.isList,
					descriptionFields: field.descriptionFields,
					detailFields: field.detailFields,
					inheritedFields: field.inheritedFields
				};
			}
		}

		if (_.isArray(meta.relations)) {
			for (let relation of Array.from(meta.relations)) {
				if (References[relation.document] == null) { References[relation.document] = {}; }
				if (References[relation.document].relationsFrom == null) { References[relation.document].relationsFrom = {}; }
				if (References[relation.document].relationsFrom[metaName] == null) { References[relation.document].relationsFrom[metaName] = []; }
				References[relation.document].relationsFrom[metaName].push(relation);

				if (References[metaName] == null) { References[metaName] = {}; }
				if (References[metaName].relationsTo == null) { References[metaName].relationsTo = {}; }
				if (References[metaName].relationsTo[relation.document] == null) { References[metaName].relationsTo[relation.document] = []; }
				References[metaName].relationsTo[relation.document].push(relation);
			}
		}
	}

	return References;
};