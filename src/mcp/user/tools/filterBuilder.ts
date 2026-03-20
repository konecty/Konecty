import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KonFilter } from '@imports/model/Filter';
import { z } from 'zod';
import { registerMcpTool } from '../../shared/registerTool';
import { READ_ONLY_ANNOTATION } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps } from '../../shared/textFormatters';
import { getOperatorsForType } from '../../shared/fieldTypeOperators';

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

const ConditionSchema = z.object({
	field: z.string().min(1).describe('Technical field name or lookup path, e.g. status or supplier._id'),
	operator: FilterOperatorSchema,
	value: z.unknown().optional().describe('Scalar, array for in/not_in, or object for between'),
	fieldType: z.string().optional().describe('Field type from modules_fields (e.g. dateTime, picklist, lookup._id, text, number). When provided, validates operator compatibility.'),
});

const FilterBuildInputSchema = z
	.object({
		match: z.enum(['and', 'or']).default('and'),
		conditions: z.array(ConditionSchema).default([]),
		textSearch: z.string().optional(),
	})
	.refine(data => data.conditions.length > 0 || (data.textSearch != null && data.textSearch.trim().length > 0), {
		message: 'Provide at least one condition or a non-empty textSearch.',
	});

function validateOperatorForType(
	field: string,
	operator: string,
	fieldType: string,
): { valid: true } | { valid: false; message: string } {
	const validOps = getOperatorsForType(fieldType);
	if (validOps == null) {
		return { valid: true };
	}
	if (validOps.includes(operator)) {
		return { valid: true };
	}
	return {
		valid: false,
		message:
			`Operator "${operator}" is not valid for field "${field}" of type "${fieldType}". ` +
			`Valid operators: ${validOps.join(', ')}.`,
	};
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SHORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function validateDateValue(field: string, value: unknown, fieldType: string): string | null {
	if (fieldType !== 'date' && fieldType !== 'dateTime') {
		return null;
	}
	if (value == null || typeof value !== 'string') {
		return null;
	}
	if (ISO_DATE_REGEX.test(value)) {
		return null;
	}
	if (SHORT_DATE_REGEX.test(value)) {
		return `Field "${field}" (${fieldType}): value "${value}" is missing time and timezone. Use ISO 8601 format: "${value}T00:00:00Z".`;
	}
	if (BR_DATE_REGEX.test(value)) {
		const [dd, mm, yyyy] = value.split('/');
		return `Field "${field}" (${fieldType}): value "${value}" is in DD/MM/YYYY format. Use ISO 8601: "${yyyy}-${mm}-${dd}T00:00:00Z".`;
	}
	return null;
}

export function registerFilterBuilderTools(server: McpServer): void {
	registerMcpTool(
		server,
		'filter_build',
		{
			description:
				'Builds a validated Konecty filter. Only call when you need to filter — if you want ALL records, omit the filter parameter in records_find/query_pivot/query_graph instead. ' +
				'Each condition maps field to term + operator + value. Provide fieldType (from modules_fields) for operator validation. ' +
				'System fields: _createdAt/_updatedAt are dateTime (ISO 8601), _user._id/_createdBy._id/_updatedBy._id are lookup._id, _id is ObjectId. ' +
				'Does not require auth. Does not execute any query.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				match: z.enum(['and', 'or']).default('and').describe('How to combine conditions'),
				conditions: z
					.array(
						z.object({
							field: z.string(),
							operator: FilterOperatorSchema,
							value: z.unknown().optional(),
							fieldType: z
								.string()
								.optional()
								.describe(
									'Field type from modules_fields (e.g. dateTime, picklist, lookup._id, text, number, ObjectId). Enables operator validation.',
								),
						}),
					)
					.default([])
					.describe('List of { field, operator, value, fieldType? }'),
				textSearch: z.string().optional().describe('Optional full-text search string on the document'),
			},
		},
		async rawArgs => {
			const parsed = FilterBuildInputSchema.safeParse(rawArgs);
			if (!parsed.success) {
				const isEmpty = parsed.error.errors.some(e => e.message.includes('at least one condition'));
				if (isEmpty) {
					return toMcpErrorResult(
						'VALIDATION_ERROR',
						'filter_build called with no conditions and no textSearch. If you want ALL records, simply omit the filter parameter in records_find/query_pivot/query_graph — no filter_build call is needed.',
						'Call records_find with just document and authTokenId (no filter) to retrieve all records.',
					);
				}
				const hint = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
				return toMcpErrorResult('VALIDATION_ERROR', hint);
			}

			const { match, conditions, textSearch } = parsed.data;

			const typeErrors: string[] = [];
			const dateWarnings: string[] = [];
			for (const cond of conditions) {
				if (cond.fieldType != null) {
					const check = validateOperatorForType(cond.field, cond.operator, cond.fieldType);
					if (!check.valid) {
						typeErrors.push(check.message);
					}
					const dateCheck = validateDateValue(cond.field, cond.value, cond.fieldType);
					if (dateCheck != null) {
						dateWarnings.push(dateCheck);
					}
				}
			}

			if (typeErrors.length > 0) {
				return toMcpErrorResult(
					'VALIDATION_ERROR',
					`Operator/type mismatch:\n${typeErrors.join('\n')}\nCheck modules_fields for field types and use a valid operator.`,
				);
			}

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
			const nextSteps = [
				'Pass the filter object as the "filter" argument to records_find, query_pivot, or query_graph.',
			];
			if (dateWarnings.length > 0) {
				nextSteps.unshift(`Date format warning: ${dateWarnings.join(' ')}`);
			}

			return toMcpSuccessResult({ filter, filterJson }, appendNextSteps(`Konecty filter (validated):\n${filterJson}`, nextSteps));
		},
	);
}
