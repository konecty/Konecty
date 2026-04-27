import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import slugify from 'slugify';

import type { UploadBaseNameStrategy } from '../types';

/** Campos de ficheiro de "marca" da imobiliária cujo nome no storage remoto beneficia de ser previsível. */
const AGENCY_OFFICE_LOGO_LIKE_FIELD_NAMES = new Set(['logo', 'pictures']);

const REMOTE_BASENAME_PREFIX = 'logo-agencia';

/**
 * Padrão de basename para upload em Office (ex.: `logo-agencia-<code?>-<slug|name>-<hash>`)
 * a partir de `slug`/`name` e `code` do registo. Usa `fallback` (típico: hash) como sufixo estável.
 * Outros documentos/campos: devolve `null` (deixa outra estratégia ou o fallback padrão).
 */
export const tryOfficeAgencyBrandingUploadBaseName: UploadBaseNameStrategy = async ({ document, recordId, fieldName, fallback }) => {
	if (document !== 'Office' || !AGENCY_OFFICE_LOGO_LIKE_FIELD_NAMES.has(fieldName)) {
		return null;
	}

	const collection = MetaObject.Collections['Office'];
	if (collection == null) {
		logger.trace('tryOfficeAgencyBrandingUploadBaseName: collection Office indisponível');
		return null;
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
			return `${REMOTE_BASENAME_PREFIX}-${codePart}-${labelSlug}-${fallback}`;
		}
		return `${REMOTE_BASENAME_PREFIX}-${labelSlug}-${fallback}`;
	} catch (error) {
		logger.error(error, 'tryOfficeAgencyBrandingUploadBaseName: falha a ler registo Office');
		return fallback;
	}
};
