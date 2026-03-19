import { find, graphStream, pivotStream } from '@imports/data/api';
import crossModuleQuery from '@imports/data/api/crossModuleQuery';
import { sqlToIQR } from '@imports/data/api/sqlToRelationsParser';
import { update } from '@imports/data/api/update';
import { create, deleteData, findById, findByLookup } from '@imports/data/data';
import { getExplorerModules } from '@imports/data/api/explorerModules';
import { KonFilter } from '@imports/model/Filter';
import { MetaObject } from '@imports/model/MetaObject';
import { getLabel } from '@imports/meta/metaUtils';
import { getDocument } from '@imports/document';
import { MetaObjectSchema } from '@imports/types/metadata';
import { checkMetaOperation } from '@imports/utils/accessUtils';
import { z } from 'zod';

const QueryJsonInputSchema = z.object({
	query: z.record(z.unknown()),
	includeMeta: z.boolean().optional(),
});

const QuerySqlInputSchema = z.object({
	sql: z.string().min(1),
	includeTotal: z.boolean().optional(),
	includeMeta: z.boolean().optional(),
});

const SortDirectionSchema = z.union([z.literal('ASC'), z.literal('DESC'), z.literal('asc'), z.literal('desc')]);
const SortItemSchema = z
	.object({
		property: z.string().optional(),
		term: z.string().optional(),
		direction: SortDirectionSchema,
	})
	.refine(item => item.property != null || item.term != null, {
		message: 'Each sort item must include property or term',
	});

const SortArraySchema = z.array(SortItemSchema).min(1);

const RecordFindInputSchema = z.object({
	document: z.string(),
	filter: z.unknown().optional(),
	sort: z.unknown().optional(),
	fields: z.string().optional(),
	limit: z.union([z.number(), z.string()]).optional(),
	start: z.union([z.number(), z.string()]).optional(),
	withDetailFields: z.boolean().optional(),
});

const RecordCreateInputSchema = z.object({
	document: z.string(),
	data: z.record(z.unknown()),
});

const RecordUpdateInputSchema = z.object({
	document: z.string(),
	ids: z
		.array(
			z.object({
				_id: z.string(),
				_updatedAt: z.union([z.string().datetime(), z.object({ $date: z.string().datetime() })]),
			}),
		)
		.min(1),
	data: z.record(z.unknown()),
});

const RecordDeleteInputSchema = z.object({
	document: z.string(),
	ids: z
		.array(
			z.object({
				_id: z.string(),
				_updatedAt: z.union([z.string().datetime(), z.object({ $date: z.string().datetime() })]),
			}),
		)
		.min(1),
});

export async function proxyModules(authTokenId: string, user: Record<string, unknown>) {
	return getExplorerModules(user as never);
}

type DocumentCandidate = {
	documentId: string;
	labelPt: string;
	labelEn: string;
};

function getDocumentCandidates(document: string): DocumentCandidate[] {
	const normalized = document.trim().toLowerCase();
	return Object.entries(MetaObject.Meta)
		.map(([documentId, meta]) => ({
			documentId,
			labelPt: String(getLabel(meta, 'pt_BR') ?? ''),
			labelEn: String(getLabel(meta, 'en') ?? ''),
		}))
		.filter(({ documentId, labelPt, labelEn }) => {
			const values = [documentId, labelPt, labelEn].map(value => value.trim().toLowerCase());
			return values.includes(normalized);
		});
}

function resolveDocumentId(document: string):
	| { documentId: string; resolvedFrom?: string }
	| { error: { message: string } } {
	if (MetaObject.Meta[document] != null) {
		return { documentId: document };
	}

	const candidates = getDocumentCandidates(document);
	if (candidates.length === 1) {
		return {
			documentId: candidates[0].documentId,
			resolvedFrom: document,
		};
	}

	if (candidates.length > 1) {
		const suggestions = candidates.map(({ documentId, labelPt }) => `"${documentId}" (label: "${labelPt || documentId}")`).join(', ');
		return {
			error: {
				message: `Ambiguous document identifier "${document}". Use the technical _id from modules_list.modules[].document. Possible values: ${suggestions}.`,
			},
		};
	}

	return {
		error: {
			message: `Invalid document identifier "${document}". Use the technical _id from modules_list.modules[].document, not label/name.`,
		},
	};
}

function buildInvalidDocumentError(document: string) {
	const candidates = getDocumentCandidates(document);

	if (candidates.length > 0) {
		const suggestions = candidates.map(({ documentId, labelPt }) => `"${documentId}" (label: "${labelPt || documentId}")`).join(', ');
		return {
			success: false as const,
			errors: [
				{
					message: `Invalid document identifier "${document}". Use the technical _id from modules_list.modules[].document, not label/name. Suggested document values: ${suggestions}.`,
				},
			],
		};
	}

	return {
		success: false as const,
		errors: [
			{
				message: `Invalid document identifier "${document}". Use the technical _id from modules_list.modules[].document, not label/name.`,
			},
		],
	};
}

const KON_FILTER_RESERVED_KEYS = new Set(['match', 'conditions', 'filters', 'textSearch']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyFilterSnippet(filter: unknown): string {
	try {
		const text = JSON.stringify(filter);
		return text.length > 800 ? `${text.slice(0, 800)}…` : text;
	} catch {
		return '[unserializable filter]';
	}
}

function buildInvalidFilterError(filter: unknown, extra?: string) {
	const snippet = stringifyFilterSnippet(filter);
	const base =
		`Invalid Konecty filter: ${snippet}. ` +
		`Konecty requires match ("and"|"or") and structured conditions: { "match": "and", "conditions": [{ "term": "fieldName", "operator": "equals", "value": "…" }] }. ` +
		`Do NOT use Mongo-style { "field": "value" } — it is ignored and returns unfiltered results. ` +
		`Use the filter_build MCP tool to assemble a valid filter, or copy the shape from filter_build structuredContent.`;
	return {
		success: false as const,
		errors: [{ message: extra != null && extra.length > 0 ? `${base} ${extra}` : base }],
	};
}

/**
 * Ensures filter is undefined, empty, or a valid KonFilter before calling find/pivot/graph.
 * Rejects Mongo-style objects and other shapes that parseFilterObject would silently drop.
 */
function normalizeKonectyFilter(filter: unknown): { success: true; data: unknown } | ReturnType<typeof buildInvalidFilterError> {
	if (filter == null) {
		return { success: true, data: undefined };
	}

	if (!isPlainRecord(filter)) {
		return buildInvalidFilterError(filter, 'Filter must be a JSON object.');
	}

	const keys = Object.keys(filter);
	if (keys.length === 0) {
		return { success: true, data: undefined };
	}

	const hasReserved = keys.some(key => KON_FILTER_RESERVED_KEYS.has(key));
	if (!hasReserved) {
		return buildInvalidFilterError(
			filter,
			'Detected a filter without match/conditions/filters/textSearch (likely Mongo-style or wrong shape).',
		);
	}

	let toValidate: Record<string, unknown> = filter;
	if (filter.match == null && filter.conditions == null && filter.filters == null && typeof filter.textSearch === 'string') {
		toValidate = { match: 'and', textSearch: filter.textSearch };
	} else if (filter.match == null && (filter.conditions != null || filter.filters != null)) {
		toValidate = { match: 'and', ...filter };
	}

	const parsed = KonFilter.safeParse(toValidate);
	if (!parsed.success) {
		const zodHint = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
		return buildInvalidFilterError(filter, `Schema validation failed: ${zodHint}`);
	}

	return { success: true, data: parsed.data };
}

function buildInvalidSortError(sort: unknown) {
	const sortJson = (() => {
		try {
			return JSON.stringify(sort);
		} catch {
			return '[unserializable sort]';
		}
	})();

	return {
		success: false as const,
		errors: [
			{
				message: `Invalid sort format: ${sortJson}. Konecty MCP expects sort as an array of objects with property/term and direction ASC|DESC. Example: [{"property":"_createdAt","direction":"DESC"}]. Do not use Mongo style {"_createdAt":-1} or [{"_createdAt":"desc"}].`,
			},
		],
	};
}

function normalizeKonectySort(sort: unknown) {
	if (sort == null) {
		return { success: true as const, data: undefined };
	}

	const parsed = SortArraySchema.safeParse(sort);
	if (!parsed.success) {
		return buildInvalidSortError(sort);
	}

	return {
		success: true as const,
		data: parsed.data.map(item => ({
			...(item.property != null ? { property: item.property } : {}),
			...(item.term != null ? { term: item.term } : {}),
			direction: item.direction.toUpperCase(),
		})),
	};
}

export function proxyModuleFields(document: string) {
	const resolved = resolveDocumentId(document);
	if ('error' in resolved) {
		return {
			success: false as const,
			errors: [resolved.error],
		};
	}

	const meta = MetaObject.Meta[resolved.documentId];
	if (meta == null) {
		return buildInvalidDocumentError(document);
	}

	return {
		success: true,
		data: {
			document: resolved.documentId,
			...(resolved.resolvedFrom != null
				? {
						documentResolution: {
							input: resolved.resolvedFrom,
							resolved: resolved.documentId,
							note: 'Input label/name was normalized to technical _id. Use the resolved value in subsequent tools.',
						},
					}
				: {}),
			fields: meta.fields ?? {},
		},
	};
}

export async function proxyRecordsFind(authTokenId: string, input: unknown) {
	const parsed = RecordFindInputSchema.parse(input);
	if (MetaObject.Meta[parsed.document] == null) {
		return buildInvalidDocumentError(parsed.document);
	}
	const normalizedSort = normalizeKonectySort(parsed.sort);
	if (!normalizedSort.success) {
		return normalizedSort;
	}
	const normalizedFilter = normalizeKonectyFilter(parsed.filter);
	if (!normalizedFilter.success) {
		return normalizedFilter;
	}
	return find({
		authTokenId,
		document: parsed.document,
		filter: normalizedFilter.data as never,
		sort: normalizedSort.data,
		fields: parsed.fields,
		limit: parsed.limit,
		start: parsed.start,
		withDetailFields: String(parsed.withDetailFields === true),
		getTotal: true,
	} as never);
}

export async function proxyRecordsFindById(authTokenId: string, input: { document: string; recordId: string; fields?: string; withDetailFields?: boolean }) {
	if (MetaObject.Meta[input.document] == null) {
		return buildInvalidDocumentError(input.document);
	}
	return findById({
		authTokenId,
		document: input.document,
		dataId: input.recordId,
		fields: input.fields,
		withDetailFields: String(input.withDetailFields === true),
	});
}

export async function proxyRecordsCreate(authTokenId: string, input: unknown) {
	const parsed = RecordCreateInputSchema.parse(input);
	if (MetaObject.Meta[parsed.document] == null) {
		return buildInvalidDocumentError(parsed.document);
	}
	return create({
		authTokenId,
		document: parsed.document,
		data: parsed.data,
	});
}

export async function proxyRecordsUpdate(authTokenId: string, input: unknown) {
	const parsed = RecordUpdateInputSchema.parse(input);
	if (MetaObject.Meta[parsed.document] == null) {
		return buildInvalidDocumentError(parsed.document);
	}
	return update({
		authTokenId,
		document: parsed.document,
		data: {
			ids: parsed.ids as never,
			data: parsed.data,
		},
	});
}

export async function proxyRecordsDelete(authTokenId: string, input: unknown) {
	const parsed = RecordDeleteInputSchema.parse(input);
	if (MetaObject.Meta[parsed.document] == null) {
		return buildInvalidDocumentError(parsed.document);
	}
	return deleteData({
		authTokenId,
		document: parsed.document,
		data: {
			ids: parsed.ids as never,
		},
		contextUser: null,
	});
}

export async function proxyQueryJson(authTokenId: string, input: unknown) {
	const parsed = QueryJsonInputSchema.parse(input);
	return crossModuleQuery({
		authTokenId,
		body: parsed.query,
	});
}

export async function proxyQuerySql(authTokenId: string, input: unknown) {
	const parsed = QuerySqlInputSchema.parse(input);
	const iqr = sqlToIQR(parsed.sql);
	return crossModuleQuery({
		authTokenId,
		body: {
			...iqr,
			includeMeta: parsed.includeMeta ?? false,
			includeTotal: parsed.includeTotal ?? true,
		},
	});
}

export async function proxyQueryPivot(authTokenId: string, input: { document: string; filter?: unknown; pivotConfig: unknown; fields?: string; sort?: unknown; limit?: number | string }) {
	const normalizedSort = normalizeKonectySort(input.sort);
	if (!normalizedSort.success) {
		return normalizedSort;
	}
	const normalizedFilter = normalizeKonectyFilter(input.filter);
	if (!normalizedFilter.success) {
		return normalizedFilter;
	}
	return pivotStream({
		authTokenId,
		document: input.document,
		filter: normalizedFilter.data as never,
		pivotConfig: input.pivotConfig as never,
		fields: input.fields as never,
		sort: normalizedSort.data as never,
		limit: input.limit != null ? String(input.limit) : undefined,
		lang: 'pt_BR',
	});
}

export async function proxyQueryGraph(authTokenId: string, input: { document: string; filter?: unknown; graphConfig: unknown; fields?: string; sort?: unknown; limit?: number | string }) {
	const normalizedSort = normalizeKonectySort(input.sort);
	if (!normalizedSort.success) {
		return normalizedSort;
	}
	const normalizedFilter = normalizeKonectyFilter(input.filter);
	if (!normalizedFilter.success) {
		return normalizedFilter;
	}
	return graphStream({
		authTokenId,
		document: input.document,
		filter: normalizedFilter.data as never,
		graphConfig: input.graphConfig as never,
		fields: input.fields as never,
		sort: normalizedSort.data as never,
		limit: input.limit != null ? String(input.limit) : undefined,
		lang: 'pt_BR',
	});
}

export function proxyFieldPicklistOptions(document: string, fieldName: string) {
	const resolved = resolveDocumentId(document);
	if ('error' in resolved) {
		return { success: false as const, errors: [resolved.error] };
	}

	const meta = MetaObject.Meta[resolved.documentId];
	if (meta == null) {
		return buildInvalidDocumentError(document);
	}

	const field = meta.fields?.[fieldName];
	if (field == null) {
		return {
			success: false as const,
			errors: [{ message: `Field "${fieldName}" not found in "${resolved.documentId}". Use modules_fields to list available fields.` }],
		};
	}

	if (field.type !== 'picklist' || field.options == null) {
		return {
			success: false as const,
			errors: [
				{
					message: `Field "${fieldName}" in "${resolved.documentId}" is type "${field.type}", not "picklist". field_picklist_options only works for picklist fields.`,
				},
			],
		};
	}

	const options = Object.entries(field.options).map(([key, optionData]) => {
		const labels = typeof optionData === 'object' && optionData != null ? (optionData as Record<string, unknown>) : {};
		return {
			key,
			sort: typeof labels.sort === 'number' ? labels.sort : undefined,
			pt_BR: typeof labels.pt_BR === 'string' ? labels.pt_BR : undefined,
			en: typeof labels.en === 'string' ? labels.en : undefined,
		};
	});

	options.sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

	return {
		success: true as const,
		data: {
			document: resolved.documentId,
			fieldName,
			fieldLabel: getLabel(field, 'pt_BR') ?? getLabel(field, 'en') ?? fieldName,
			options,
		},
	};
}

export async function proxyFieldLookupSearch(
	authTokenId: string,
	document: string,
	fieldName: string,
	search: string,
	options?: { extraFilter?: unknown; start?: number; limit?: number },
) {
	const resolved = resolveDocumentId(document);
	if ('error' in resolved) {
		return { success: false as const, errors: [resolved.error] };
	}

	const meta = MetaObject.Meta[resolved.documentId];
	if (meta == null) {
		return buildInvalidDocumentError(document);
	}

	const field = meta.fields?.[fieldName];
	if (field == null) {
		return {
			success: false as const,
			errors: [{ message: `Field "${fieldName}" not found in "${resolved.documentId}". Use modules_fields to list available fields.` }],
		};
	}

	if (field.type !== 'lookup' && field.type !== 'inheritLookup') {
		return {
			success: false as const,
			errors: [
				{
					message: `Field "${fieldName}" in "${resolved.documentId}" is type "${field.type}", not "lookup". field_lookup_search only works for lookup/inheritLookup fields.`,
				},
			],
		};
	}

	const relatedDocument = field.document ?? '';
	const descriptionFields = field.descriptionFields ?? [];

	const result = await findByLookup({
		authTokenId,
		document: resolved.documentId,
		field: fieldName,
		search,
		extraFilter: options?.extraFilter,
		start: options?.start != null ? String(options.start) : undefined,
		limit: options?.limit != null ? String(options.limit) : '10',
		useChangeUserFilter: undefined,
	});

	if (result.success !== true) {
		return {
			success: false as const,
			errors: 'errors' in result && Array.isArray(result.errors) ? result.errors : [{ message: 'Lookup search failed.' }],
		};
	}

	const records = Array.isArray(result.data) ? result.data : [];
	return {
		success: true as const,
		data: {
			document: resolved.documentId,
			fieldName,
			relatedDocument,
			descriptionFields,
			records,
			total: result.total ?? records.length,
		},
	};
}

function requireMetaPermission(user: Record<string, unknown>, operation: 'readAccess' | 'updateDocument' | 'deleteDocument', document: string) {
	if (user.admin === true) {
		return true;
	}

	return checkMetaOperation({
		user: user as never,
		operation,
		document,
	});
}

export async function proxyMetaRead(user: Record<string, unknown>, name: string) {
	if (!requireMetaPermission(user, 'readAccess', name)) {
		return { success: false, errors: [{ message: 'Forbidden' }] };
	}
	const result = await getDocument(name);
	return { success: result != null, data: result, errors: result == null ? [{ message: 'Document not found' }] : [] };
}

export async function proxyMetaUpsert(user: Record<string, unknown>, id: string, payload: unknown) {
	if (!requireMetaPermission(user, 'updateDocument', id)) {
		return { success: false, errors: [{ message: 'Forbidden' }] };
	}

	const parsed = MetaObjectSchema.safeParse(payload);
	if (!parsed.success) {
		return { success: false, errors: parsed.error.issues.map(issue => ({ message: `${issue.path.join('.')}: ${issue.message}` })) };
	}

	const result = await MetaObject.MetaObject.replaceOne({ _id: id }, parsed.data as never, { upsert: true });
	return {
		success: true,
		data: {
			matchedCount: result.matchedCount,
			modifiedCount: result.modifiedCount,
			upsertedCount: result.upsertedCount,
			upsertedId: result.upsertedId,
		},
	};
}

export async function proxyMetaDelete(user: Record<string, unknown>, id: string) {
	if (!requireMetaPermission(user, 'deleteDocument', id)) {
		return { success: false, errors: [{ message: 'Forbidden' }] };
	}

	const result = await MetaObject.MetaObject.deleteOne({ _id: id });
	return {
		success: result.deletedCount > 0,
		data: { deletedCount: result.deletedCount },
		errors: result.deletedCount > 0 ? [] : [{ message: 'Meta object not found' }],
	};
}

export async function proxyMetaListByType(type: string) {
	const docs = await MetaObject.MetaObject.find({ type }).toArray();
	return { success: true, data: docs };
}

export async function proxyMetaNamespaceUpdate(user: Record<string, unknown>, patch: Record<string, unknown>) {
	if (user.admin !== true) {
		return { success: false, errors: [{ message: 'Admin access required' }] };
	}

	const result = await MetaObject.MetaObject.updateOne({ type: 'namespace' }, { $set: patch });
	return {
		success: true,
		data: {
			matchedCount: result.matchedCount,
			modifiedCount: result.modifiedCount,
		},
	};
}
