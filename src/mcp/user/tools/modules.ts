import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { getUserSafe } from '@imports/auth/getUser';
import { z } from 'zod';
import { proxyFieldPicklistOptions, proxyModuleFields, proxyModules } from '../../shared/konectyProxy';
import { AUTH_TOKEN_SCHEMA, READ_ONLY_ANNOTATION, authRequiredError, resolveToken } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatKeyValues, formatModuleList } from '../../shared/textFormatters';

type ModuleToolDeps = {
	authTokenId: () => string;
	user: () => Record<string, unknown>;
};

export function registerModuleTools(server: McpServer, deps: ModuleToolDeps): void {
	registerMcpTool(server, 
		'modules_list',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Lists all accessible modules and queryable fields. Use modules[].document as the technical _id in all records_* tools. Returns: module summary in content.text and full module payload in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ authTokenId }) => {
			try {
				const token = resolveToken(authTokenId, deps.authTokenId());
				if (token == null) {
					return authRequiredError();
				}

				const fallbackUser = deps.user();
				let user = fallbackUser;
				if (Object.keys(fallbackUser).length === 0) {
					const userResult = await getUserSafe(token);
					if (userResult.success !== true) {
						return authRequiredError();
					}
					user = userResult.data as unknown as Record<string, unknown>;
				}

				const result = await proxyModules(token, user);
				const modules = Array.isArray((result as { modules?: unknown }).modules)
					? ((result as { modules: Array<{ document?: unknown; label?: unknown }> }).modules ?? [])
					: [];
				const usageHint =
					'For records_find/records_create/records_update/records_delete/query_pivot/query_graph, always pass document with the technical _id from modules[].document (never modules[].label or display name).';
				const moduleIdentifiers = modules.map(module => ({
					document: String(module.document ?? ''),
					label: String(module.label ?? module.document ?? ''),
				}));
				const text = appendNextSteps(
					`Modules loaded.\n${formatModuleList(moduleIdentifiers)}`,
					[
						'Always use modules[].document (_id) as the document parameter in records/query tools.',
						'For single-module retrievals use records_find.',
						'For cross-module retrievals use query_json unless SQL was explicitly requested.',
					],
				);
				return toMcpSuccessResult(
					{
						...(result as unknown as Record<string, unknown>),
						usageHint,
						queryStrategyHint:
							'Use records_find for single-module retrievals and query_json as default for cross-module retrievals. Use query_sql only when SQL is explicitly requested.',
						moduleIdentifiers,
					},
					text,
				);
			} catch (error) {
				return toMcpErrorResult('INTERNAL_ERROR', (error as Error).message);
			}
		},
	);

	registerMcpTool(server, 
		'modules_fields',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Returns metadata fields for a document. document must be modules_list.modules[].document (_id), not label/name. ' +
				'Fields of type "picklist" have embedded options — use field_picklist_options to get exact accepted keys before filtering. ' +
				'Fields of type "lookup" have a "document" property indicating the related module — use field_lookup_search to resolve the related record _id before filtering. ' +
				'Returns: field summary in content.text and { success, module } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = proxyModuleFields(document);
			if (result.success !== true) {
				return toMcpErrorResult('NOT_FOUND', JSON.stringify('errors' in result ? result.errors : []));
			}

			const moduleData = result.data as Record<string, unknown>;
			const resolution = moduleData.documentResolution as Record<string, unknown> | undefined;
			const resolvedDocument = String(moduleData.document ?? document);
			const normalized = resolution != null;
			const summary = formatKeyValues(moduleData);
			const text = normalized
				? `Module fields loaded. Input "${document}" was normalized to technical document _id "${resolvedDocument}". Use "${resolvedDocument}" in subsequent tools.`
				: 'Module fields loaded.';
		const finalText = appendNextSteps(`${text}\n${summary}`, ['Use modules_fields output to build valid filters and payloads for records/query tools.']);
		return toMcpSuccessResult({ module: moduleData }, finalText);
	},
);

	registerMcpTool(server,
		'field_picklist_options',
		{
			description:
				'Returns valid option keys and labels for a picklist field. Call this BEFORE filtering by a picklist field to get the exact option keys accepted by the database. ' +
				'Use the key value (not the label) when building filters for records_find. ' +
				'Returns: numbered list of key/label pairs in content.text and { success, document, fieldName, options: Array<{ key, sort?, pt_BR?, en? }> } in structuredContent. ' +
				'Requires authTokenId.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				fieldName: z.string(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, fieldName, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = proxyFieldPicklistOptions(document, fieldName);
			if (!result.success) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors));
			}

			const { data } = result;
			const lines = data.options.map((opt, index) => {
				const labels = [
					opt.pt_BR != null ? `pt_BR: "${opt.pt_BR}"` : null,
					opt.en != null ? `en: "${opt.en}"` : null,
				].filter(Boolean).join(' | ');
				return `${index + 1}. key: "${opt.key}"${labels.length > 0 ? ` | ${labels}` : ''}`;
			});
			const text = appendNextSteps(
				`Picklist options for field "${fieldName}" in "${data.document}" (${data.options.length} option(s)):\n${lines.join('\n')}`,
				[
					`Use the key value (not the label) in Konecty filter format: { "match": "and", "conditions": [{ "term": "${fieldName}", "operator": "equals", "value": "<key>" }] }.`,
					`For multiple values: { "term": "${fieldName}", "operator": "in", "value": ["<key1>", "<key2>"] }. DO NOT use Mongo-style { "${fieldName}": "<key>" }.`,
				],
			);
			return toMcpSuccessResult(data, text);
		},
	);
}
