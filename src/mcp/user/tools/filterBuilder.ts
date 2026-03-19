import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KonFilter } from '@imports/model/Filter';
import { z } from 'zod';
import { registerMcpTool } from '../../shared/registerTool';
import { READ_ONLY_ANNOTATION } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps } from '../../shared/textFormatters';

/** Operators accepted by Konecty filter parsing (see filterUtils validOperators). */
const FILTER_OPERATORS = [
	'equals',
	'not_equals',
	'starts_with',
	'end_with',
	'contains',
	'not_contains',
	'less_than',
	'greater_than',
	'less_or_equals',
	'greater_or_equals',
	'between',
	'current_user',
	'not_current_user',
	'current_user_group',
	'not_current_user_group',
	'current_user_groups',
	'in',
	'not_in',
	'exists',
] as const;

const FilterOperatorSchema = z.enum(FILTER_OPERATORS);

const FilterBuildInputSchema = z
	.object({
		match: z.enum(['and', 'or']).default('and'),
		conditions: z
			.array(
				z.object({
					field: z.string().min(1).describe('Technical field name or lookup path, e.g. status or supplier._id'),
					operator: FilterOperatorSchema,
					value: z.unknown().optional().describe('Scalar, array for in/not_in, or object for between'),
				}),
			)
			.default([]),
		textSearch: z.string().optional(),
	})
	.refine(data => data.conditions.length > 0 || (data.textSearch != null && data.textSearch.trim().length > 0), {
		message: 'Provide at least one condition or a non-empty textSearch.',
	});

export function registerFilterBuilderTools(server: McpServer): void {
	registerMcpTool(
		server,
		'filter_build',
		{
			description:
				'Builds a valid Konecty filter JSON (no query execution). Prefer this before records_find, query_pivot, and query_graph so filters are not rejected or silently ignored. Maps each condition field → term with operator and value. Does not require auth.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				match: z.enum(['and', 'or']).default('and').describe('How to combine conditions'),
				conditions: z
					.array(
						z.object({
							field: z.string(),
							operator: FilterOperatorSchema,
							value: z.unknown().optional(),
						}),
					)
					.default([])
					.describe('List of { field, operator, value } — field becomes term in the Konecty filter'),
				textSearch: z.string().optional().describe('Optional full-text search string on the document'),
			},
		},
		async rawArgs => {
			const parsed = FilterBuildInputSchema.safeParse(rawArgs);
			if (!parsed.success) {
				const hint = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', hint);
			}

			const { match, conditions, textSearch } = parsed.data;
			const built: Record<string, unknown> = { match };
			if (conditions.length > 0) {
				built.conditions = conditions.map(({ field, operator, value }) => ({
					term: field,
					operator,
					...(value !== undefined ? { value } : {}),
				}));
			}
			if (textSearch != null && textSearch.trim().length > 0) {
				built.textSearch = textSearch.trim();
			}

			const validated = KonFilter.safeParse(built);
			if (!validated.success) {
				const hint = validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', `Built filter failed Konecty schema: ${hint}`);
			}

			const filter = validated.data;
			const filterJson = JSON.stringify(filter, null, 2);
			const text = appendNextSteps(`Konecty filter (validated):\n${filterJson}`, [
				'Pass the filter object as the "filter" argument to records_find, query_pivot, or query_graph.',
				'Use field_picklist_options / field_lookup_search when filtering picklists or lookups.',
			]);

			return toMcpSuccessResult({ filter, filterJson }, text);
		},
	);
}
