import type { BuildFindQueryParams } from '@imports/data/api/findUtils';
import type { Span } from '@opentelemetry/api';

/**
 * Pivot table configuration types
 */

export type PivotAggregator = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface PivotColumn {
	field: string;
	order?: 'ASC' | 'DESC';
	format?: string;
}

export interface PivotRow {
	field: string;
	order?: 'ASC' | 'DESC';
}

export interface PivotValue {
	field: string;
	aggregator: PivotAggregator;
}

export interface PivotConfig {
	columns?: PivotColumn[];
	rows: PivotRow[];
	values: PivotValue[];
}

/**
 * RPC Protocol types for Python communication
 */
export interface RPCRequest {
	jsonrpc: '2.0';
	method: string;
	params: {
		config: PivotEnrichedConfig;
	};
}

export interface RPCResponse {
	jsonrpc: '2.0';
	result?: {
		status: string;
		rowCount: number;
	};
	error?: {
		code: number;
		message: string;
	};
}

/**
 * Pivot stream function parameters
 */
export interface PivotStreamParams extends BuildFindQueryParams {
	pivotConfig: PivotConfig;
	transformDatesToString?: boolean;
	tracingSpan?: Span;
	lang?: string;
}

export interface PivotStreamResult {
	success: true;
	data: Record<string, unknown>[];
	total?: number;
}

/**
 * Lookup display configuration for formatting lookup values
 */
export interface LookupDisplayConfig {
	document: string;
	displayField: string; // Campo principal de exibição
	formatPattern?: string; // Ex: "{name} ({active})"
	simpleFields: string[]; // Campos simples dos descriptionFields
	nestedFields: string[]; // Campos aninhados (ignorados na formatação)
}

/**
 * Picklist option with key and label
 */
export interface PicklistOption {
	key: string;
	label: string;
}

/**
 * Metadata for pivot row
 */
export interface PivotRowMeta {
	field: string;
	label: string;
	type: string;
	level: number;
	lookup?: LookupDisplayConfig; // Se for lookup
}

/**
 * Metadata for pivot column
 */
export interface PivotColumnMeta {
	field: string;
	label: string;
	type: string;
	values?: PicklistOption[]; // Se for picklist
	lookup?: LookupDisplayConfig; // Se for lookup
}

/**
 * Metadata for pivot value
 */
export interface PivotValueMeta {
	field: string;
	aggregator: PivotAggregator;
	label: string;
	type: string;
	format?: string; // Ex: "currency"
}

/**
 * Enriched pivot configuration with metadata
 */
export interface PivotEnrichedConfig {
	rows: PivotRowMeta[];
	columns?: PivotColumnMeta[];
	values: PivotValueMeta[];
}

/**
 * Pivot hierarchy node with nested children
 */
export interface PivotHierarchyNode {
	key: string; // Unique key for the row (e.g., _id or composite key)
	label: string; // Formatted label for display
	level: number; // Hierarchy level (0 = root)
	cells: Record<string, Record<string, number>>; // Column key -> value field -> aggregated value
	totals: Record<string, number>; // Value field -> total for this row
	children?: PivotHierarchyNode[]; // Nested rows
}

/**
 * Grand totals for all data
 */
export interface PivotGrandTotals {
	cells: Record<string, Record<string, number>>; // Column key -> value field -> aggregated value
	totals: Record<string, number>; // Value field -> grand total
}

/**
 * Enhanced pivot result with hierarchical structure
 */
export interface PivotEnrichedResult {
	success: true;
	metadata: {
		rows: PivotRowMeta[];
		columns?: PivotColumnMeta[];
		values: PivotValueMeta[];
	};
	data: PivotHierarchyNode[];
	grandTotals: PivotGrandTotals;
	total?: number;
}

