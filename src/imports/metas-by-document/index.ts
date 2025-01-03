import { getUserSafe } from '@imports/auth/getUser';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectSchema, MetaObjectType } from '@imports/types/metadata';
import { getAccessFor } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';
import isObject from 'lodash/isObject';
import metaFormatter from './metaFormatter';

type Params = {
	authTokenId: string;
	document: string;
};

export async function getMetasByDocument({ document, authTokenId }: Params) {
	const metas = await MetaObject.MetaObject.find<MetaObjectType>({
		$or: [
			{ name: document, type: 'document' },
			{ document, type: { $nin: ['namespace', 'access'] } },
		],
	}).toArray();

	if (metas.length === 0) {
		throw new Error(`Document ${document} not found.`);
	}

	const userResult = await getUserSafe(authTokenId);
	if (userResult.success === false) {
		throw new Error(`Document ${document} not found.`);
	}

	const { data: user } = userResult;

	const accessCache: Record<string, MetaAccess | false> = {};

	const getAccess = (documentName: string) => {
		if (!accessCache[documentName]) {
			accessCache[documentName] = getAccessFor(documentName, user);
		}

		return accessCache[documentName];
	};

	const accesses: string[] = [];

	const accessVerifiedMetas = metas.flatMap(meta => {
		const access = getAccess(meta.document || meta.name);

		if (access === false && !['document', 'composite'].includes(meta.type)) {
			return [];
		}

		if (['document', 'composite'].includes(meta.type) && isObject(access)) {
			accesses.push((access as any)._id);
		}

		return meta;
	});

	const accessMetas = await MetaObject.MetaObject.find<MetaObjectType>({ _id: { $in: accesses } }).toArray();

	accessVerifiedMetas.push(...accessMetas);

	const validatedMetas = accessVerifiedMetas.map(meta => {
		const parsed = MetaObjectSchema.safeParse(meta);

		if (parsed.success === false) {
			logger.error(
				{
					form: meta,
					error: parsed.error,
				},
				`Error parsing meta ${meta.document ? meta.document + '/' : ''}${meta.type}/${meta.name}`,
			);

			return {
				...meta,
				failedMetaValidation: true,
			};
		}

		return parsed.data;
	});

	const formattedMetas = validatedMetas.map(meta => {
		if (metaFormatter[meta!.type]) {
			return metaFormatter[meta!.type](meta);
		}

		return meta;
	});

	return formattedMetas;
}
