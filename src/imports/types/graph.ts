import type { BuildFindQueryParams } from '@imports/data/api/findUtils';
import type { Span } from '@opentelemetry/api';

/**
 * Graph configuration types
 */

export type GraphType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'timeSeries';

export interface GraphAxis {
	field: string;
	label?: string;
	format?: string; // Para formatação de valores
}

export interface GraphConfig {
	type: GraphType;
	xAxis?: GraphAxis; // Obrigatório para bar, line, scatter, timeSeries
	yAxis?: GraphAxis; // Obrigatório para bar, line, scatter, histogram
	categoryField?: string; // Para agrupar (ex: status, type)
	aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // Para agregação
	title?: string;
	width?: number; // Largura em pixels (padrão: 800)
	height?: number; // Altura em pixels (padrão: 600)
	colors?: string[]; // Cores customizadas
	showLegend?: boolean; // Padrão: true
	showGrid?: boolean; // Padrão: true
}

/**
 * Graph stream function parameters
 */
export interface GraphStreamParams extends BuildFindQueryParams {
	graphConfig: GraphConfig;
	transformDatesToString?: boolean;
	tracingSpan?: Span;
	lang?: string;
}

/**
 * Graph stream result
 */
export interface GraphStreamResult {
	success: true;
	svg: string;
	total?: number;
}

