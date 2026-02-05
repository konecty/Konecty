import type { BuildFindQueryParams } from '@imports/data/api/findUtils';
import type { Span } from '@opentelemetry/api';
import type { DateBucket } from '@imports/types/pivot';

/**
 * Graph configuration types
 */

export type GraphType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'timeSeries';

export interface GraphAxis {
	field: string;
	label?: string;
	format?: string; // Para formatação de valores
	bucket?: DateBucket; // Agrupador de data/hora (D=dia, W=semana, M=mês, Q=trimestre, Y=ano)
}

export interface GraphSeries {
	field: string; // Campo Y da série
	label?: string; // Label traduzido/customizado
	aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // Agregação da série
	color?: string; // Cor em hex (ex: '#FF5733')
	bucket?: DateBucket; // Agrupador de data/hora para campos de data
}

export interface GraphHistogramBinsConfig {
	binWidth?: number; // Largura do bin (mutuamente exclusivo com binCount)
	binCount?: number; // Quantidade de bins (mutuamente exclusivo com binWidth)
	underflow?: number; // Valor mínimo para agrupar valores abaixo
	overflow?: number; // Valor máximo para agrupar valores acima
}

export interface GraphConfig {
	type: GraphType;
	xAxis?: GraphAxis; // Obrigatório para bar, line, scatter, timeSeries
	yAxis?: GraphAxis; // Obrigatório para bar, line, scatter, histogram (compatibilidade)
	series?: GraphSeries[]; // Múltiplas séries (alternativa a yAxis+aggregation)
	categoryField?: string; // Para agrupar (ex: status, type)
	categoryFieldLabel?: string; // Label traduzido para categoryField
	categoryFieldBucket?: DateBucket; // Agrupador de data/hora para categoryField
	aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // Para agregação (compatibilidade)
	title?: string;
	width?: number; // Largura em pixels (padrão: 800)
	height?: number; // Altura em pixels (padrão: 600)
	colors?: string[]; // Cores customizadas
	showLegend?: boolean; // Padrão: true
	showGrid?: boolean; // Padrão: true
	histogram?: GraphHistogramBinsConfig; // Configuração de bins para histograma
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

