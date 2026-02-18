import { z } from 'zod';
import { KonFilter } from '@imports/model/Filter';
import type { Span } from '@opentelemetry/api';
import type { User } from '@imports/model/User';

const AGGREGATOR_NAMES = ['count', 'sum', 'avg', 'min', 'max', 'first', 'last', 'push', 'addToSet'] as const;
const MAX_RELATIONS = 10;
const MAX_NESTING_DEPTH = 2;
const MAX_RELATION_LIMIT = 100_000;
const DEFAULT_RELATION_LIMIT = 1000;
const DEFAULT_PRIMARY_LIMIT = 1000;

export const AggregatorEnum = z.enum(AGGREGATOR_NAMES);

export const AggregatorSchema = z.object({
	aggregator: AggregatorEnum,
	field: z.string().optional(),
});

const SortItem = z.object({
	property: z.string(),
	direction: z.enum(['ASC', 'DESC']).default('ASC'),
});

const ExplicitJoinCondition = z
	.object({
		left: z.string(),
		right: z.string(),
	})
	.optional();

type RelationInput = {
	document: string;
	lookup: string;
	on?: { left: string; right: string };
	filter?: z.infer<typeof KonFilter>;
	fields?: string;
	sort?: string | Array<{ property: string; direction?: 'ASC' | 'DESC' }>;
	limit?: number;
	start?: number;
	aggregators: Record<string, { aggregator: (typeof AGGREGATOR_NAMES)[number]; field?: string }>;
	relations?: RelationInput[];
};

export const RelationSchema: z.ZodType<RelationInput> = z.lazy(() =>
	z.object({
		document: z.string(),
		lookup: z.string(),
		on: ExplicitJoinCondition,
		filter: KonFilter.optional(),
		fields: z.string().optional(),
		sort: z.union([z.string(), z.array(SortItem)]).optional(),
		limit: z.number().int().min(1).max(MAX_RELATION_LIMIT).optional().default(DEFAULT_RELATION_LIMIT),
		start: z.number().int().min(0).optional(),
		aggregators: z.record(z.string(), AggregatorSchema).refine(obj => Object.keys(obj).length > 0, {
			message: 'At least one aggregator is required per relation',
		}),
		relations: z.array(RelationSchema).max(MAX_RELATIONS).optional(),
	}),
);

export const CrossModuleQuerySchema = z.object({
	document: z.string(),
	filter: KonFilter.optional(),
	fields: z.string().optional(),
	sort: z.union([z.string(), z.array(SortItem)]).optional(),
	limit: z.number().int().min(1).max(MAX_RELATION_LIMIT).default(DEFAULT_PRIMARY_LIMIT),
	start: z.number().int().min(0).default(0),
	relations: z.array(RelationSchema).min(1).max(MAX_RELATIONS),
	includeTotal: z.boolean().default(false),
	includeMeta: z.boolean().default(true),
});

export type CrossModuleQuery = z.infer<typeof CrossModuleQuerySchema>;
export type CrossModuleRelation = z.infer<typeof RelationSchema>;
export type Aggregator = z.infer<typeof AggregatorSchema>;
export type AggregatorName = z.infer<typeof AggregatorEnum>;

export interface CrossModuleQueryParams {
	authTokenId?: string;
	contextUser?: User;
	body: unknown;
	tracingSpan?: Span;
}

export interface RelationPythonConfig {
	dataset: string;
	parentKey: string;
	childKey: string;
	aggregators: Record<string, { aggregator: string; field?: string }>;
	relations?: RelationPythonConfig[];
}

export interface CrossModulePythonConfig {
	parentDataset: string;
	relations: RelationPythonConfig[];
}

export interface CrossModuleRPCRequest {
	jsonrpc: '2.0';
	method: 'aggregate';
	params: {
		config: CrossModulePythonConfig;
	};
}

export interface CrossModuleWarning {
	type: 'RELATION_ACCESS_DENIED' | 'LIMIT_REACHED' | 'MISSING_INDEX' | 'LARGE_DATASET';
	document?: string;
	message: string;
}

export interface CrossModuleMeta {
	document: string;
	relations: string[];
	warnings: CrossModuleWarning[];
	executionTimeMs?: number;
}

export { MAX_RELATIONS, MAX_NESTING_DEPTH, MAX_RELATION_LIMIT, DEFAULT_RELATION_LIMIT, DEFAULT_PRIMARY_LIMIT };
