import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyQueryGraph, proxyQueryJson, proxyQueryPivot, proxyQuerySql } from '../../shared/konectyProxy';
import { AUTH_TOKEN_SCHEMA, READ_ONLY_ANNOTATION, authRequiredError, resolveToken } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatKeyValues, formatRecordList } from '../../shared/textFormatters';

type QueryToolDeps = {
	authTokenId: () => string;
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

export function registerQueryTools(server: McpServer, deps: QueryToolDeps): void {
	registerMcpTool(server, 
		'query_json',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Default tool for cross-module retrievals in MCP. Prefer this over query_sql unless SQL is explicitly requested. Returns: record summary in content.text and { success, records, meta, total } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				query: z.record(z.unknown()),
				includeMeta: z.boolean().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyQueryJson(token, args);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const total = result.total ?? result.records.length;
			const text = appendNextSteps(
				`Cross-module JSON query executed.\nTotal: ${total}\n${formatRecordList(result.records)}`,
				['Use render_records_widget only for single-module table rendering.', 'Use query_pivot or query_graph for aggregated visual outputs.'],
			);
			return toMcpSuccessResult({ records: result.records, meta: result.meta, total: result.total }, text);
		},
	);

	registerMcpTool(server, 
		'query_sql',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Executes cross-module query using SQL syntax. Use only when user explicitly requests SQL or provides SQL input. Returns: record summary in content.text and { success, records, meta, total } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				sql: z.string(),
				includeMeta: z.boolean().optional(),
				includeTotal: z.boolean().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyQuerySql(token, args);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const total = result.total ?? result.records.length;
			const text = appendNextSteps(
				`Cross-module SQL query executed.\nTotal: ${total}\n${formatRecordList(result.records)}`,
				['Prefer query_json for non-SQL tasks to reduce ambiguity.', 'Use query_pivot or query_graph for aggregated visual outputs.'],
			);
			return toMcpSuccessResult({ records: result.records, meta: result.meta, total: result.total }, text);
		},
	);

	registerMcpTool(server, 
		'query_pivot',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Builds pivot data from query result. Returns: pivot summary in content.text and { success, pivot } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				filter: z.unknown().optional(),
				pivotConfig: z.record(z.unknown()),
				fields: z.string().optional(),
				sort: z.array(SORT_ITEM_SCHEMA).optional(),
				limit: z.number().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyQueryPivot(token, args as never);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const text = appendNextSteps(
				`Pivot data generated for "${args.document}".\n${formatKeyValues(result as unknown as Record<string, unknown>)}`,
				['Use render_pivot_widget with pivot rows when visual output is required.'],
			);
			return toMcpSuccessResult({ pivot: result }, text);
		},
	);

	registerMcpTool(server, 
		'query_graph',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Builds graph data from query result. Returns: graph summary in content.text and { success, graph } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				filter: z.unknown().optional(),
				graphConfig: z.record(z.unknown()),
				fields: z.string().optional(),
				sort: z.array(SORT_ITEM_SCHEMA).optional(),
				limit: z.number().optional(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyQueryGraph(token, args as never);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const text = appendNextSteps(
				`Graph data generated for "${args.document}".\n${formatKeyValues(result as unknown as Record<string, unknown>)}`,
				['Use render_graph_widget with the produced SVG output for visualization.'],
			);
			return toMcpSuccessResult({ graph: result }, text);
		},
	);

	registerMcpTool(server, 
		'render_pivot_widget',
		{
			description: 'Renders pivot widget. Returns: render summary in content.text and { success, rows } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				rows: z.array(z.record(z.unknown())),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/pivot' },
		},
		async ({ rows }) => toMcpSuccessResult({ rows }, `Rendering pivot widget with ${rows.length} row(s).`),
	);

	registerMcpTool(server, 
		'render_graph_widget',
		{
			description: 'Renders graph widget. Returns: render summary in content.text and { success, svg } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				svg: z.string(),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/graph' },
		},
		async ({ svg }) => toMcpSuccessResult({ svg }, `Rendering graph widget (svg length: ${svg.length}).`),
	);
}
