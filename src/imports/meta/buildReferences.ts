import { Field } from '@imports/model/Field';
import { Relation } from '@imports/model/Relation';
import { MetaObjectType } from '@imports/types/metadata';

type Reference = Pick<Field, 'type' | 'isList' | 'descriptionFields' | 'inheritedFields' | 'detailFields'> & { field: string };

type References = {
	[document: string]: {
		from?: {
			[metaName: string]: {
				[fieldName: string]: Reference;
			};
		};
		relationsFrom?: {
			[metaName: string]: Relation[];
		};
		relationsTo?: {
			[metaName: string]: Relation[];
		};
	};
};

export default function buildReferences(Meta: Record<string, MetaObjectType>) {
	const References: References = {};

	for (const metaName in Meta) {
		const meta = Meta[metaName];

		if (meta.type !== 'document') continue;

		for (const fieldName in meta.fields) {
			const field = meta.fields[fieldName];
			if (field.type === 'lookup' && field.document) {
				References[field.document] = {
					...References[field.document],
					from: {
						...References[field.document]?.from,
						[metaName]: {
							...References[field.document]?.from?.[metaName],
							[fieldName]: {
								type: field.type,
								field: fieldName,
								isList: field.isList,
								descriptionFields: field.descriptionFields,
								detailFields: field.detailFields,
								inheritedFields: field.inheritedFields,
							},
						},
					},
				};
			}
		}

		if (Array.isArray(meta.relations)) {
			for (const relation of meta.relations) {
				References[relation.document] = {
					...References[relation.document],
					relationsFrom: {
						...References[relation.document]?.relationsFrom,
						[metaName]: [...(References[relation.document]?.relationsFrom?.[metaName] || []), relation],
					},

					relationsTo: {
						...References[relation.document]?.relationsTo,
						[relation.document]: [...(References[relation.document]?.relationsTo?.[relation.document] || []), relation],
					},
				};
			}
		}
	}

	return References;
}
