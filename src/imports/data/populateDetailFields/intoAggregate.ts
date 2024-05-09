import { MetaObject } from '@imports/model/MetaObject';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '@imports/utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';

export default function addDetailFieldsIntoAggregate(document: string, projection: Record<string, number>) {
	const metaObject = MetaObject.Meta[document];
	const lookupStages = [];

	const lookupFields = Object.keys(metaObject.fields).filter(fieldName => metaObject.fields[fieldName].type === 'lookup' && metaObject.fields[fieldName].detailFields?.length);
	const fieldsRetrieved = Object.keys(projection ?? {}).map(field => field.split('.')[0]);
	const lookupsToPopulate = lookupFields.filter(lookupField => fieldsRetrieved.includes(lookupField));

	for (const lookup of lookupsToPopulate) {
		const field = metaObject.fields[lookup];
		lookupStages.push({
			$lookup: {
				from: MetaObject.Collections[field.document ?? 'no-coll'].collectionName,
				localField: `${lookup}._id`,
				foreignField: '_id',
				as: lookup,
			},
		});

		if (field.isList !== true) {
			lookupStages.push({ $addFields: { [lookup]: { $arrayElemAt: [`$${lookup}`, 0] } } });
		}

		const lookupProjection = ['_id'].concat(field.detailFields ?? []).concat(field.descriptionFields ?? []);
		const detailFieldsProjection = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(lookupProjection.map(detailField => `${field.name}.${detailField}`).join());
		delete projection[lookup];

		Object.assign(projection, detailFieldsProjection);
	}

	return lookupStages;
}
