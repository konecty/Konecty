import { MetaObject } from '@imports/model/MetaObject';
import type { User } from '@imports/model/User';
import { getAccessFor, getFieldPermissions } from '@imports/utils/accessUtils';
import { getLabel } from '@imports/meta/metaUtils';

const LANG_DEFAULT = 'pt_BR';
const QUERYABLE_TYPES = ['document', 'composite'] as const;

export interface ExplorerFieldMeta {
	name: string;
	type: string;
	label: string;
	options?: Record<string, string>;
	document?: string;
	descriptionFields?: string[];
}

export interface ExplorerReverseLookup {
	document: string;
	lookup: string;
	label: string;
}

export interface ExplorerModuleMeta {
	document: string;
	label: string;
	fields: ExplorerFieldMeta[];
	reverseLookups: ExplorerReverseLookup[];
}

export interface ExplorerModulesResult {
	modules: ExplorerModuleMeta[];
}

export function getExplorerModules(user: User, lang: string = LANG_DEFAULT): ExplorerModulesResult {
	const modules: ExplorerModuleMeta[] = [];

	for (const documentName of Object.keys(MetaObject.Meta)) {
		const meta = MetaObject.Meta[documentName];
		if (meta == null || !QUERYABLE_TYPES.includes(meta.type as (typeof QUERYABLE_TYPES)[number])) {
			continue;
		}

		const access = getAccessFor(documentName, user);
		if (access === false || access.isReadable !== true) {
			continue;
		}

		const fields: ExplorerFieldMeta[] = [];
		if (meta.fields) {
			for (const [fieldName, field] of Object.entries(meta.fields)) {
				const perms = getFieldPermissions(access, fieldName);
				if (!perms.isReadable) continue;

				const label = getLabel(field, lang) || fieldName;
				const item: ExplorerFieldMeta = { name: fieldName, type: field.type ?? 'text', label };
				if (field.type === 'picklist' && field.options != null && typeof field.options === 'object') {
					item.options = field.options as unknown as Record<string, string>;
				}
				if (field.type === 'lookup' || field.type === 'inheritLookup') {
					if (field.document != null) item.document = field.document;
					item.descriptionFields = field.descriptionFields ?? [];
				}
				fields.push(item);
			}
		}

		const reverseLookups = findReverseLookups(documentName, user, lang);
		modules.push({
			document: documentName,
			label: getLabel(meta, lang) || documentName,
			fields,
			reverseLookups,
		});
	}

	return { modules };
}

function findReverseLookups(parentDocumentName: string, user: User, lang: string): ExplorerReverseLookup[] {
	const result: ExplorerReverseLookup[] = [];

	for (const docName of Object.keys(MetaObject.Meta)) {
		const meta = MetaObject.Meta[docName];
		if (meta == null || !meta.fields) continue;
		if (getAccessFor(docName, user) === false) continue;

		for (const [fieldName, field] of Object.entries(meta.fields)) {
			if ((field.type !== 'lookup' && field.type !== 'inheritLookup') || field.document !== parentDocumentName) {
				continue;
			}
			result.push({
				document: docName,
				lookup: fieldName,
				label: getLabel(meta, lang) || docName,
			});
		}
	}

	return result;
}
