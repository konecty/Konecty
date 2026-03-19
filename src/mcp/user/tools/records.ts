import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyRecordsCreate, proxyRecordsDelete, proxyRecordsFind, proxyRecordsFindById, proxyRecordsUpdate } from '../../shared/konectyProxy';
import { AUTH_TOKEN_SCHEMA, DELETE_ANNOTATION, READ_ONLY_ANNOTATION, WRITE_ANNOTATION, authRequiredError, resolveToken } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatRecord, formatRecordList, formatWriteConfirmation } from '../../shared/textFormatters';

type RecordToolDeps = {
	authTokenId: () => string;
	baseUiUrl: string;
};

const SORT_ITEM_SCHEMA = z
	.object({
		property: z.string().optional(),
		term: z.string().optional(),
		direction: z.enum(['ASC', 'DESC', 'asc', 'desc']),
	})
	.refine(item => item.property != null || item.term != null, {
		message: 'sort item must include property or term',
	});

function getOpenInKonectyUrl(baseUiUrl: string, document: string, recordId: string): string {
	return `${baseUiUrl}/module/${document}/form/Default/document/${recordId}`;
}

export function registerRecordTools(server: McpServer, deps: RecordToolDeps): void {
	registerMcpTool(server, 
		'records_find',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Find records using Konecty filter format. document must be the technical module _id (modules_list.modules[].document), not label/name. ' +
				'Prefer filter_build to produce a validated filter, then pass it here. ' +
				'Filter shape: { "match": "and"|"or", "conditions": [{ "term": "<fieldName>", "operator": "<op>", "value": "<val>" }] } (optional textSearch). ' +
				'Operators: equals, not_equals, contains, not_contains, starts_with, end_with, in, not_in, greater_than, less_than, greater_or_equals, less_or_equals, between, exists. ' +
				'Picklist: exact keys from field_picklist_options. Lookup: term "fieldName._id" with equals/in and _id from field_lookup_search. Nested OR: "filters" array. ' +
				'Mongo-style { "status": "Ativo" } is rejected by the server with an explicit error. ' +
				'Returns: visible record list in content.text and { success, total, records } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				filter: z.unknown().optional().describe(
					'Use filter_build output or { "match": "and"|"or", "conditions": [{ "term", "operator", "value" }], "textSearch"? }. Mongo-style top-level field maps are rejected.',
				),
				sort: z.array(SORT_ITEM_SCHEMA).optional(),
				fields: z.string().optional(),
				limit: z.number().optional(),
				start: z.number().optional(),
				withDetailFields: z.boolean().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyRecordsFind(token, args);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const total = result.total ?? result.data?.length ?? 0;
			const text = appendNextSteps(
				`Found ${total} record(s) in "${args.document}".\n${formatRecordList(result.data)}`,
				['Use records_find_by_id for full details of a specific record.', 'Use render_records_widget to render a table widget.'],
			);
			return toMcpSuccessResult({ records: result.data, total }, text);
		},
	);

	registerMcpTool(server, 
		'records_find_by_id',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Reads a single record by id. document must be the technical module _id (modules_list.modules[].document), not label/name. Returns: key record fields in content.text and { success, record } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				fields: z.string().optional(),
				withDetailFields: z.boolean().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyRecordsFindById(token, args);
			if (result.success !== true || !Array.isArray(result.data) || result.data.length === 0) {
				return toMcpErrorResult('NOT_FOUND', JSON.stringify('errors' in result ? result.errors : []));
			}
			const record = result.data[0] as Record<string, unknown>;
			const text = appendNextSteps(
				`Record loaded from "${args.document}".\n${formatRecord(record)}`,
				['Use records_update with _id and _updatedAt for optimistic locking.', 'Use render_record_widget or render_record_card for UI rendering.'],
			);
			return toMcpSuccessResult({ record }, text);
		},
	);

	registerMcpTool(server, 
		'records_create',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Creates a new record. document must be the technical module _id (modules_list.modules[].document), not label/name. Returns: creation summary in content.text and { success, records } in structuredContent.',
			annotations: WRITE_ANNOTATION,
			inputSchema: {
				document: z.string(),
				data: z.record(z.unknown()),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyRecordsCreate(token, args);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const created = Array.isArray(result.data) ? (result.data[0] as Record<string, unknown> | undefined) : undefined;
			const text = appendNextSteps(
				created != null
					? formatWriteConfirmation('Created record in', args.document, created)
					: `Record created successfully in "${args.document}".`,
				['Use records_find_by_id to verify the persisted data.'],
			);
			return toMcpSuccessResult({ records: result.data }, text);
		},
	);

	registerMcpTool(server, 
		'records_update',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Updates records using optimistic locking (_updatedAt required). document must be the technical module _id (modules_list.modules[].document), not label/name. Returns: update summary in content.text and { success, records } in structuredContent.',
			annotations: WRITE_ANNOTATION,
			inputSchema: {
				document: z.string(),
				ids: z
					.array(
						z.object({
							_id: z.string(),
							_updatedAt: z.union([z.string(), z.object({ $date: z.string() })]),
						}),
					)
					.min(1),
				data: z.record(z.unknown()),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyRecordsUpdate(token, args);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const updated = Array.isArray(result.data) ? (result.data[0] as Record<string, unknown> | undefined) : undefined;
			const text = appendNextSteps(
				updated != null
					? formatWriteConfirmation('Updated record in', args.document, updated)
					: `Record updated successfully in "${args.document}".`,
				['Use records_find_by_id to fetch latest _updatedAt and current values.'],
			);
			return toMcpSuccessResult({ records: result.data }, text);
		},
	);

	registerMcpTool(server, 
		'records_delete_preview',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Preview target record before delete. document must be the technical module _id (modules_list.modules[].document), not label/name. Returns: preview fields in content.text and { success, preview } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				fields: z.string().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, recordId, fields, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyRecordsFindById(token, { document, recordId, fields, withDetailFields: true });
			if (result.success !== true || !Array.isArray(result.data) || result.data.length === 0) {
				return toMcpErrorResult('NOT_FOUND', JSON.stringify('errors' in result ? result.errors : []));
			}
			const preview = result.data[0] as Record<string, unknown>;
			const text = appendNextSteps(
				`Delete preview loaded for "${document}".\n${formatRecord(preview)}`,
				['If deletion is confirmed, call records_delete with confirm=true and the same _id/_updatedAt pair.'],
			);
			return toMcpSuccessResult({ preview }, text);
		},
	);

	registerMcpTool(server, 
		'records_delete',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Deletes one record after explicit confirmation. document must be the technical module _id (modules_list.modules[].document), not label/name. Returns: deletion summary in content.text and { success, deleted } in structuredContent.',
			annotations: DELETE_ANNOTATION,
			inputSchema: {
				document: z.string(),
				confirm: z.boolean(),
				ids: z
					.array(
						z.object({
							_id: z.string(),
							_updatedAt: z.union([z.string(), z.object({ $date: z.string() })]),
						}),
					)
					.min(1)
					.max(1),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			if (args.confirm !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', 'The confirm flag must be true.');
			}
			const result = await proxyRecordsDelete(token, { document: args.document, ids: args.ids });
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const deletedText = args.ids.length > 0 ? `Deleted record _id "${args.ids[0]._id}" from "${args.document}".` : `Record deleted from "${args.document}".`;
			return toMcpSuccessResult({ deleted: result.data }, deletedText);
		},
	);

	registerMcpTool(server, 
		'render_records_widget',
		{
			description: 'Renders records table widget. Returns: render summary in content.text and { success, records, openInKonectyBaseUrl } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				records: z.array(z.record(z.unknown())),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/records-table' },
		},
		async ({ document, records }) =>
			toMcpSuccessResult(
				{
					records,
					openInKonectyBaseUrl: `${deps.baseUiUrl}/module/${document}/form/Default/document`,
				},
				`Rendering records table for "${document}" with ${records.length} row(s).`,
			),
	);

	registerMcpTool(server, 
		'render_record_widget',
		{
			description: 'Renders record detail widget. Returns: render summary in content.text and { success, record, openInKonectyUrl } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				record: z.record(z.unknown()),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/record-detail' },
		},
		async ({ document, recordId, record }) =>
			toMcpSuccessResult(
				{
					record,
					openInKonectyUrl: getOpenInKonectyUrl(deps.baseUiUrl, document, recordId),
				},
				`Rendering record detail for "${document}" and record "${recordId}".`,
			),
	);

	registerMcpTool(server, 
		'render_record_card',
		{
			description: 'Renders visual record card widget with image carousel. Returns: render summary in content.text and { success, record, images, highlightFields, openInKonectyUrl } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				record: z.record(z.unknown()),
				imageFields: z.array(z.string()).optional(),
				highlightFields: z.array(z.string()).optional(),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/record-card' },
		},
		async ({ document, recordId, record, imageFields = [], highlightFields = [] }) => {
			const images = imageFields
				.map(fieldName => record[fieldName])
				.flatMap(value => (Array.isArray(value) ? value : value != null ? [value] : []))
				.map(value => (typeof value === 'string' ? value : typeof value === 'object' && value != null && 'url' in value ? String((value as { url: unknown }).url) : ''))
				.filter(Boolean);

			return toMcpSuccessResult(
				{
					record,
					images,
					highlightFields,
					openInKonectyUrl: getOpenInKonectyUrl(deps.baseUiUrl, document, recordId),
				},
				`Rendering record card for "${document}" and record "${recordId}" with ${images.length} image(s).`,
			);
		},
	);
}
