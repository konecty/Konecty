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

const AGGREGATOR_NAMES = ['count', 'countDistinct', 'sum', 'avg', 'min', 'max', 'first', 'last', 'push', 'addToSet'] as const;

function summarizeAggregations(query: Record<string, unknown>): string {
	const parts: string[] = [];
	const groupBy = query.groupBy as string[] | undefined;
	if (Array.isArray(groupBy) && groupBy.length > 0) {
		parts.push(`Grouped by: ${groupBy.join(', ')}`);
	}
	const aggregators = query.aggregators as Record<string, unknown> | undefined;
	if (aggregators != null && typeof aggregators === 'object') {
		const keys = Object.keys(aggregators);
		if (keys.length > 0) {
			parts.push(`Root aggregators: ${keys.join(', ')}`);
		}
	}
	const relations = query.relations as Array<Record<string, unknown>> | undefined;
	if (Array.isArray(relations) && relations.length > 0) {
		const relSummaries = relations.map(r => {
			const doc = r.document as string;
			const aggs = r.aggregators as Record<string, unknown> | undefined;
			const aggNames = aggs != null ? Object.keys(aggs).join(', ') : 'none';
			return `${doc} (aggregators: ${aggNames})`;
		});
		parts.push(`Relations: ${relSummaries.join('; ')}`);
	}
	return parts.length > 0 ? parts.join('\n') : '';
}

export function registerQueryTools(server: McpServer, deps: QueryToolDeps): void {
	registerMcpTool(server, 
		'query_json',
		{
			description:
				'Cross-module query with relations and aggregation. Requires authTokenId. ' +
				'Preferred over query_sql for all cross-module retrievals. ' +
				'Supports: relations (join child modules), groupBy (GROUP BY), aggregators (count, sum, avg, min, max, first, last, push, addToSet, countDistinct). ' +
				'query.document: primary module _id from modules_list. ' +
				'query.relations: array of { document, lookup, aggregators: { alias: { aggregator, field? } }, filter?, fields?, sort?, limit? }. Each relation MUST have ≥1 aggregator. Max 10 relations. ' +
				'query.groupBy: array of field paths for grouping. Use with query.aggregators for consolidated results. ' +
				'query.aggregators: { alias: { aggregator: "count"|"sum"|"avg"|..., field?: "fieldName" } }. sum/avg/min/max require field; count does not. Money fields: use "field.value". ' +
				'Example — count + sum per parent: relations: [{ document: "Opportunity", lookup: "contact", aggregators: { total: { aggregator: "count" }, revenue: { aggregator: "sum", field: "value.value" } } }]. ' +
				'Example — group by status: { document: "Contact", groupBy: ["status"], aggregators: { count: { aggregator: "count" } } }. ' +
				'Returns: { success, records, meta, total } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				query: z.object({
					document: z.string().describe('Primary module _id from modules_list'),
					filter: z.unknown().optional().describe('OPTIONAL. Omit to query all records. When filtering, use output from filter_build.'),
					fields: z.string().optional().describe('Comma-separated field names for the primary module'),
					sort: z.union([z.string(), z.array(SORT_ITEM_SCHEMA)]).optional(),
					limit: z.number().optional().describe('Max records for primary module (default 1000, max 100000)'),
					start: z.number().optional().describe('Offset for primary module'),
					relations: z.array(
						z.object({
							document: z.string().describe('Related (child) module _id'),
							lookup: z.string().describe('Lookup field in child pointing to parent'),
							on: z.object({ left: z.string(), right: z.string() }).optional().describe('Explicit join condition (optional)'),
							filter: z.unknown().optional().describe('Filter for child records (from filter_build)'),
							fields: z.string().optional().describe('Comma-separated fields for child module'),
							sort: z.union([z.string(), z.array(SORT_ITEM_SCHEMA)]).optional(),
							limit: z.number().optional().describe('Max child records per parent (default 1000)'),
							start: z.number().optional(),
							aggregators: z.record(
								z.string(),
								z.object({
									aggregator: z.enum(AGGREGATOR_NAMES).describe('Aggregation function'),
									field: z.string().optional().describe('Field to aggregate (required for sum/avg/min/max/countDistinct/addToSet)'),
								}),
							).describe('REQUIRED: at least one aggregator per relation'),
							relations: z.array(z.record(z.unknown())).optional().describe('Nested relations (max depth 2)'),
						}),
					).optional().describe('Related modules to join with aggregators'),
					groupBy: z.array(z.string()).optional().describe('Field paths to GROUP BY for consolidated results'),
					aggregators: z.record(
						z.string(),
						z.object({
							aggregator: z.enum(AGGREGATOR_NAMES),
							field: z.string().optional(),
						}),
					).optional().describe('Root-level aggregators (use with groupBy for aggregated summaries)'),
					includeTotal: z.boolean().optional().describe('Include total count (default true)'),
					includeMeta: z.boolean().optional(),
				}).describe(
					'Cross-module query object. Use relations for joins, groupBy + aggregators for consolidated data.',
				),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async args => {
			const token = resolveToken(args.authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await proxyQueryJson(token, { query: args.query, includeMeta: args.query.includeMeta });
			if (result.success !== true) {
				const errDetails = ('errors' in result ? result.errors : []) as Array<{ message?: string }>;
				const detailText = errDetails.map(e => e.message ?? JSON.stringify(e)).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', detailText, [
					'Ensure document is a technical _id from modules_list.',
					'Each relation must have at least one aggregator.',
					'sum/avg/min/max/countDistinct require a field parameter.',
					'Use filter_build to construct any filters.',
				]);
			}
			const total = result.total ?? result.records.length;
			const queryObj = args.query as Record<string, unknown>;
			const aggSummary = summarizeAggregations(queryObj);
			const aggSection = aggSummary.length > 0 ? `\n${aggSummary}` : '';

			const nextSteps: string[] = [];
			if (Array.isArray(result.records) && result.records.length > 0 && !Array.isArray(queryObj.relations)) {
				nextSteps.push('Use render_records_widget for single-module table rendering.');
			}
			nextSteps.push('Use query_pivot or query_graph for aggregated visual outputs.');
			if (!Array.isArray(queryObj.groupBy) && !queryObj.aggregators) {
				nextSteps.push('For consolidated summaries, add groupBy and aggregators to the query.');
			}

			const text = appendNextSteps(
				`Cross-module query executed on "${queryObj.document}".\nTotal: ${total}${aggSection}\n${formatRecordList(result.records)}`,
				nextSteps,
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
				'Builds pivot data. Requires authTokenId. filter is OPTIONAL (omit to pivot all records). When filtering, use filter_build — Mongo-style filters are rejected. Returns: { success, pivot } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string().describe('Technical module _id from modules_list'),
				filter: z
					.unknown()
					.optional()
					.describe('OPTIONAL. Omit to pivot all records. When filtering, use output from filter_build.'),
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
				const errDetails = ('errors' in result ? result.errors : []) as Array<{ message?: string }>;
				const detailText = errDetails.map(e => e.message ?? JSON.stringify(e)).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', detailText, 'Use filter_build to construct a validated filter before calling query_pivot.');
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
				'Builds graph data. Requires authTokenId. filter is OPTIONAL (omit to graph all records). When filtering, use filter_build — Mongo-style filters are rejected. Returns: { success, graph } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string().describe('Technical module _id from modules_list'),
				filter: z
					.unknown()
					.optional()
					.describe('OPTIONAL. Omit to graph all records. When filtering, use output from filter_build.'),
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
				const errDetails = ('errors' in result ? result.errors : []) as Array<{ message?: string }>;
				const detailText = errDetails.map(e => e.message ?? JSON.stringify(e)).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', detailText, 'Use filter_build to construct a validated filter before calling query_graph.');
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
