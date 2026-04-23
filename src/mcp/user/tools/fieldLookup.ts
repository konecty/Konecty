import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerMcpTool } from '../../shared/registerTool';
import { proxyFieldLookupSearch } from '../../shared/konectyProxy';
import { AUTH_TOKEN_SCHEMA, READ_ONLY_ANNOTATION, authRequiredError, resolveToken } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatRecordList } from '../../shared/textFormatters';

type FieldLookupDeps = {
	authTokenId: () => string;
};

export function registerFieldLookupTools(server: McpServer, deps: FieldLookupDeps): void {
	registerMcpTool(
		server,
		'field_lookup_search',
		{
			description:
				'Searches related records for a lookup field. Use this BEFORE filtering records_find by a lookup field: ' +
				'first resolve the lookup target _id here, then use that _id as the filter value in Konecty filter format. ' +
				'Example: to find products by owner, call field_lookup_search on the "supplier" field in "Product" with the owner\'s name, ' +
				'get the Contact _id, then call records_find on "Product" with filter: { "match": "and", "conditions": [{ "term": "supplier._id", "operator": "equals", "value": "<contact_id>" }] }. ' +
				'If multiple matches are returned, confirm with the user before filtering. ' +
				'Returns: matching related records in content.text and { success, document, fieldName, relatedDocument, descriptionFields, records, total } in structuredContent. ' +
				'Requires authTokenId.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string().describe('Module where the lookup field lives (technical _id from modules_list).'),
				fieldName: z.string().describe('Name of the lookup field.'),
				search: z.string().describe('Text to search for in the related records (e.g. a name or code).'),
				limit: z.number().optional().describe('Max results (default 10).'),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, fieldName, search, limit, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyFieldLookupSearch(token, document, fieldName, search, {
				limit: limit ?? 10,
			});

			if (!result.success) {
				const errorMsg = result.errors.map((e: unknown) => (typeof e === 'object' && e != null ? (e as Record<string, string>).message ?? JSON.stringify(e) : String(e))).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', errorMsg);
			}

			const { data } = result;
			const records = data.records as unknown as Array<Record<string, unknown>>;
			const recordLines = records.length > 0
				? formatRecordList(records, { keyFields: ['_id', ...data.descriptionFields] })
				: 'No matching records found.';

			const filterExample = (id: string) =>
				`{ "match": "and", "conditions": [{ "term": "${fieldName}._id", "operator": "equals", "value": "${id}" }] }`;

			const text = appendNextSteps(
				`Lookup search for field "${fieldName}" in "${data.document}" → related module: "${data.relatedDocument}"\nFound ${data.total} matching record(s):\n\n${recordLines}`,
				records.length > 1
					? [
							'Confirm the correct record with the user if multiple matches were found.',
							`Use the _id as filter in records_find: ${filterExample('<_id>')}`,
							`DO NOT use Mongo-style { "${fieldName}._id": { "$in": [...] } }.`,
						]
					: records.length === 1
						? [`Use the _id as filter in records_find: ${filterExample(String(records[0]._id ?? '<_id>'))}`]
						: ['Refine the search term and try again.'],
			);

			return toMcpSuccessResult(data as unknown as Record<string, unknown>, text);
		},
	);
}
