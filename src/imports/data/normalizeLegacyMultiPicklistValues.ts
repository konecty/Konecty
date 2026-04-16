import isArray from 'lodash/isArray';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import size from 'lodash/size';

import type { Document } from '@imports/model/Document';
import type { Field } from '@imports/model/Field';
import { MetaObject } from '@imports/model/MetaObject';
import type { DataDocument } from '@imports/types/data';

function isMultiSelectPicklist(field: Field | undefined): boolean {
	if (field?.type !== 'picklist') {
		return false;
	}
	const max = field.maxSelected;
	const min = field.minSelected;
	return (isNumber(max) && max > 1) || (isNumber(min) && min > 1);
}

/**
 * Multi-select picklists (`maxSelected` / `minSelected` > 1) expect arrays in the API/UI.
 * Legacy rows often store a single option as a string; coerce to `[value]` on read so clients stay in sync.
 */
export function normalizeLegacyMultiPicklistValues(metaObject: Document, record: DataDocument): DataDocument {
	if (record == null || metaObject?.fields == null) {
		return record;
	}

	const recordObj = record as Record<string, unknown>;
	const next: Record<string, unknown> = { ...recordObj };
	let changed = false;

	for (const fieldName of Object.keys(metaObject.fields)) {
		const field = metaObject.fields[fieldName];
		if (!isMultiSelectPicklist(field)) {
			continue;
		}

		const value = next[fieldName];
		if (isString(value) && size(value) > 0) {
			next[fieldName] = [value];
			changed = true;
		}
	}

	for (const fieldName of Object.keys(metaObject.fields)) {
		const field = metaObject.fields[fieldName];
		if (field?.type !== 'lookup' || next[fieldName] == null) {
			continue;
		}

		const childDocument = field.document;
		if (childDocument == null) {
			continue;
		}

		const childMeta = MetaObject.Meta[childDocument];
		if (childMeta == null) {
			continue;
		}

		const v = next[fieldName];

		if (field.isList === true && isArray(v)) {
			const arr = v as DataDocument[];
			const mapped = arr.map(child => normalizeLegacyMultiPicklistValues(childMeta, child));
			if (mapped.some((c, i) => c !== arr[i])) {
				next[fieldName] = mapped;
				changed = true;
			}
		} else if (field.isList !== true && isObject(v) && !isArray(v)) {
			const normalized = normalizeLegacyMultiPicklistValues(childMeta, v as DataDocument);
			if (normalized !== v) {
				next[fieldName] = normalized;
				changed = true;
			}
		}
	}

	return changed ? (next as DataDocument) : record;
}
