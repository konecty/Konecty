import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import slugify from 'slugify';

export type ResolveUploadBaseNameParams = {
	document: string;
	recordId: string;
	fieldName: string;
	fallback: string;
};

const OFFICE_LOGO_FIELD_NAMES = new Set(['logo', 'pictures']);

/**
 * Uses office site slug (or name) + code for predictable remote filenames on Office (logo / pictures).
 * Pattern: logo-agencia-{code}-{slug}-{contentHash} when `code` exists; otherwise logo-agencia-{slug}-{contentHash}.
 */
export async function resolveUploadBaseName({ document, recordId, fieldName, fallback }: ResolveUploadBaseNameParams): Promise<string> {
	if (document !== 'Office' || !OFFICE_LOGO_FIELD_NAMES.has(fieldName)) {
		return fallback;
	}

	const collection = MetaObject.Collections['Office'];
	if (collection == null) {
		logger.trace('resolveUploadBaseName: Office collection not registered');
		return fallback;
	}

	try {
		const isValidCode = !Number.isNaN(Number(recordId));
		const record = await collection.findOne({ $or: [{ _id: recordId }, ...(isValidCode ? [{ code: Number(recordId) }] : [])] }, { projection: { name: 1, slug: 1, code: 1 } });
		const rawFromSlug = typeof record?.slug === 'string' ? record.slug.trim() : '';
		const rawFromName = typeof record?.name === 'string' ? record.name.trim() : '';
		const rawLabel = rawFromSlug !== '' ? rawFromSlug : rawFromName;
		if (rawLabel === '') {
			return fallback;
		}
		const labelSlug = slugify(rawLabel, { lower: true, strict: true, trim: true });
		if (labelSlug === '') {
			return fallback;
		}
		const codePart = typeof record?.code === 'number' && !Number.isNaN(record.code) ? String(record.code) : '';
		if (codePart !== '') {
			return `logo-agencia-${codePart}-${labelSlug}-${fallback}`;
		}
		return `logo-agencia-${labelSlug}-${fallback}`;
	} catch (error) {
		logger.error(error, 'resolveUploadBaseName: failed to read Office name');
		return fallback;
	}
}
