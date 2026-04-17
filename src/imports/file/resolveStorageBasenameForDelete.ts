import path from 'path';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

export type ResolveStorageBasenameForDeleteParams = {
	document: string;
	recordId: string;
	fieldName: string;
	fileNameParam: string;
};

export type ResolvedStorageDeleteTarget = {
	/** Relative directory under storage root (e.g. `Office/<id>/pictures`). Must match upload `key` dirname. */
	directory: string;
	/** Stored file basename (last segment of `key`). */
	basename: string;
};

const toFallbackTarget = (document: string, recordId: string, fieldName: string, fileNameParam: string): ResolvedStorageDeleteTarget => {
	let decoded = fileNameParam;
	try {
		decoded = decodeURIComponent(fileNameParam);
	} catch {
		decoded = fileNameParam;
	}
	const posixParam = fileNameParam.split(path.sep).join('/');
	const decodedPosix = decoded.split(path.sep).join('/');
	return {
		directory: path.posix.join(document, recordId, fieldName),
		basename: path.posix.basename(decodedPosix || posixParam),
	};
};

/**
 * Resolves the on-disk path for storage delete. The REST `fileName` param is often the original
 * upload display name, while objects are stored under `key` (basename can differ). Directory must
 * be the dirname of `key` so deletes work when the client uses `code` but paths use `_id`.
 */
export async function resolveStorageBasenameForDelete({
	document,
	recordId,
	fieldName,
	fileNameParam,
}: ResolveStorageBasenameForDeleteParams): Promise<ResolvedStorageDeleteTarget> {
	try {
		const meta = MetaObject.Meta[document];
		if (meta == null) {
			return toFallbackTarget(document, recordId, fieldName, fileNameParam);
		}
		const field = meta.fields[fieldName];
		if (field == null || field.type !== 'file') {
			return toFallbackTarget(document, recordId, fieldName, fileNameParam);
		}
		const collection = MetaObject.Collections[document];
		if (collection == null) {
			return toFallbackTarget(document, recordId, fieldName, fileNameParam);
		}

		const record = await collection.findOne({
			$or: [{ _id: recordId }, ...(!Number.isNaN(Number(recordId)) ? [{ code: Number(recordId) }] : [])],
		});
		if (record == null) {
			return toFallbackTarget(document, recordId, fieldName, fileNameParam);
		}

		let decoded = fileNameParam;
		try {
			decoded = decodeURIComponent(fileNameParam);
		} catch {
			decoded = fileNameParam;
		}

		const matchesEntry = (entry: { name?: string; key?: string } | null | undefined) => {
			if (entry == null) {
				return false;
			}
			const keyPosix = typeof entry.key === 'string' ? entry.key.split(path.sep).join('/') : '';
			const keyBasename = keyPosix !== '' ? path.posix.basename(keyPosix) : '';
			const expectedWithParam = `${document}/${recordId}/${fieldName}/${fileNameParam}`;
			const expectedWithDecoded = `${document}/${recordId}/${fieldName}/${decoded}`;
			return (
				entry.name === fileNameParam ||
				entry.name === decoded ||
				keyPosix === expectedWithParam ||
				keyPosix === expectedWithDecoded ||
				keyBasename === fileNameParam ||
				keyBasename === decoded
			);
		};

		const fieldData = record[field.name];
		if (field.isList === true) {
			const list = Array.isArray(fieldData) ? fieldData : [];
			const entry = list.find(matchesEntry);
			if (entry?.key != null && typeof entry.key === 'string') {
				const posixKey = entry.key.split(path.sep).join('/');
				return {
					directory: path.posix.dirname(posixKey),
					basename: path.posix.basename(posixKey),
				};
			}
		} else {
			const single = fieldData as { name?: string; key?: string } | null | undefined;
			if (matchesEntry(single) && single?.key != null && typeof single.key === 'string') {
				const posixKey = single.key.split(path.sep).join('/');
				return {
					directory: path.posix.dirname(posixKey),
					basename: path.posix.basename(posixKey),
				};
			}
		}
	} catch (error) {
		logger.error(error, 'resolveStorageBasenameForDelete: failed to resolve storage basename');
	}
	return toFallbackTarget(document, recordId, fieldName, fileNameParam);
}
