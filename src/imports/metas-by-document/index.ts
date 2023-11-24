import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectSchema, MetaObjectType } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';
import metaFormatter from './metaFormatter';

export async function getMetasByDocument(document: string) {
	const metas = await MetaObject.MetaObject.find<MetaObjectType>({ $or: [{ name: document, type: 'document' }, { document: document }] }).toArray();

	if (metas.length === 0) {
		throw new Error(`Document ${document} not found.`);
	}

	const validatedMetas = metas.map(meta => {
		const parsed = MetaObjectSchema.safeParse(meta);

		if (parsed.success === false) {
			logger.error(
				{
					form: meta,
					error: parsed.error,
				},
				`Error parsing meta ${meta.document}/${meta.type}/${meta.name}`,
			);
			return null;
		}

		return parsed.data;
	});

	if (validatedMetas.includes(null)) {
		return null;
	}

	const formattedMetas = validatedMetas.map(meta => {
		if (metaFormatter[meta!.type]) {
			return metaFormatter[meta!.type](meta);
		}

		return meta;
	});

	return formattedMetas;
}
