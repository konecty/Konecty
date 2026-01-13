import { MetaObject } from '@imports/model/MetaObject';
import { getLabel } from '@imports/meta/metaUtils';
import type { GraphConfig, GraphAxis } from '@imports/types/graph';

/**
 * Resolver metadados de um campo (label, type, etc) concatenando labels dos campos pais
 * Similar ao resolveFieldMeta do pivotMetadata, mas simplificado para graph
 */
function resolveFieldMeta(document: string, fieldPath: string, lang: string = 'pt_BR'): {
	label: string;
	type: string;
} {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return { label: fieldPath, type: 'text' };
	}

	const parts = fieldPath.split('.');
	const fieldName = parts[0];
	const field = meta.fields[fieldName];

	if (field == null) {
		return { label: fieldPath, type: 'text' };
	}

	// Campo simples
	if (parts.length === 1) {
		const label = getLabel(field, lang);
		const type = field.type;
		return { label, type };
	}

	// Campo aninhado - navegar recursivamente e concatenar labels
	if ((field.type === 'lookup' || field.type === 'inheritLookup') && field.document) {
		const parentLabel = getLabel(field, lang);
		const remainingPath = parts.slice(1).join('.');
		const childMeta = resolveFieldMeta(field.document, remainingPath, lang);
		
		// Concatenar labels: "Parent > Child"
		return {
			label: `${parentLabel} > ${childMeta.label}`,
			type: childMeta.type,
		};
	}

	// Campo composto (ex: amount.value)
	if (field.type === 'money' && parts[1] === 'value') {
		return {
			label: getLabel(field, lang),
			type: 'currency',
		};
	}

	return { label: fieldPath, type: 'text' };
}

/**
 * Verifica se o label é um nome técnico de campo (não traduzido)
 * Labels técnicos: começam com _, são iguais ao field, ou são camelCase típico
 */
function isUntranslatedLabel(label: string | undefined, field: string): boolean {
	if (!label) return true;
	// Se o label é igual ao field, não foi traduzido
	if (label === field) return true;
	// Se começa com _, é nome técnico
	if (label.startsWith('_')) return true;
	return false;
}

/**
 * Traduções de termos de agregação e conectivos para diferentes idiomas
 */
const TRANSLATIONS: Record<string, Record<string, string>> = {
	pt_BR: {
		// Agregações
		'Count': 'Contagem',
		'Sum': 'Soma',
		'Avg': 'Média',
		'Average': 'Média',
		'Min': 'Mínimo',
		'Max': 'Máximo',
		// Conectivos (case sensitive - manter original se não encontrar)
		' de ': ' de ',
		' por ': ' por ',
		' by ': ' por ',
		' of ': ' de ',
		' over ': ' ao longo de ',
		' vs ': ' vs ',
		'Distribution': 'Distribuição',
	},
	en: {
		// Agregações (manter em inglês)
		'Contagem': 'Count',
		'Soma': 'Sum',
		'Média': 'Average',
		'Mínimo': 'Min',
		'Máximo': 'Max',
		// Conectivos
		' de ': ' of ',
		' por ': ' by ',
		'Distribuição': 'Distribution',
	},
};

/**
 * Traduzir termos de agregação e conectivos no título
 */
function translateTitle(title: string, lang: string): string {
	const translations = TRANSLATIONS[lang] || TRANSLATIONS.pt_BR;
	let translatedTitle = title;
	
	for (const [term, translation] of Object.entries(translations)) {
		// Substituir todas as ocorrências do termo
		// Usar split/join para evitar problemas com regex
		translatedTitle = translatedTitle.split(term).join(translation);
	}
	
	return translatedTitle;
}

/**
 * Enriquecer configuração de graph com metadados (labels traduzidos)
 * Suporta múltiplas séries e formato legado
 */
export function enrichGraphConfig(document: string, graphConfig: GraphConfig, lang: string = 'pt_BR'): GraphConfig {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return graphConfig;
	}

	const enrichedConfig: GraphConfig = { ...graphConfig };
	const isEnglish = lang.toLowerCase().startsWith('en');

	// Enriquecer xAxis com label traduzido
	if (graphConfig.xAxis?.field) {
		const fieldMeta = resolveFieldMeta(document, graphConfig.xAxis.field, lang);
		const shouldUseMetaLabel = isUntranslatedLabel(graphConfig.xAxis.label, graphConfig.xAxis.field);
		enrichedConfig.xAxis = {
			...graphConfig.xAxis,
			label: shouldUseMetaLabel ? fieldMeta.label : graphConfig.xAxis.label,
		};
	}

	// Enriquecer yAxis com label traduzido (legado)
	if (graphConfig.yAxis?.field) {
		const fieldMeta = resolveFieldMeta(document, graphConfig.yAxis.field, lang);
		const shouldUseMetaLabel = isUntranslatedLabel(graphConfig.yAxis.label, graphConfig.yAxis.field);
		enrichedConfig.yAxis = {
			...graphConfig.yAxis,
			label: shouldUseMetaLabel ? fieldMeta.label : graphConfig.yAxis.label,
		};
	}

	// Enriquecer series com labels traduzidos
	if (graphConfig.series && graphConfig.series.length > 0) {
		enrichedConfig.series = graphConfig.series.map(serie => {
			const fieldMeta = resolveFieldMeta(document, serie.field, lang);
			const shouldUseMetaLabel = isUntranslatedLabel(serie.label, serie.field);
			
			return {
				...serie,
				label: shouldUseMetaLabel ? fieldMeta.label : serie.label,
			};
		});
	}

	// Enriquecer categoryField com label traduzido
	if (graphConfig.categoryField) {
		const fieldMeta = resolveFieldMeta(document, graphConfig.categoryField, lang);
		enrichedConfig.categoryFieldLabel = fieldMeta.label;
	}

	// Generate a more instructive default title when missing/empty.
	// Preserve user-provided titles (non-empty).
	if (!graphConfig.title || graphConfig.title.trim().length === 0) {
		// Try to get a module label from meta (prefer plural if available)
		const moduleLabel =
			(meta as any)?.plural?.[lang] ??
			(meta as any)?.plural?.pt_BR ??
			(meta as any)?.label?.[lang] ??
			(meta as any)?.label?.pt_BR ??
			(meta as any)?.name ??
			document;

		const groupingLabel =
			(enrichedConfig.type === 'pie' ? enrichedConfig.categoryFieldLabel : enrichedConfig.xAxis?.label) ||
			enrichedConfig.xAxis?.label ||
			enrichedConfig.categoryFieldLabel ||
			undefined;

		if (groupingLabel) {
			enrichedConfig.title = `${moduleLabel}${isEnglish ? ' by ' : ' por '}${groupingLabel}`;
		} else {
			enrichedConfig.title = String(moduleLabel);
		}
	}

	// Substituir nomes técnicos de campos no título pelos labels traduzidos
	if (graphConfig.title) {
		let newTitle = graphConfig.title;
		
		// Helper para escapar caracteres especiais de regex
		const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		
		// Substituir campo do xAxis no título
		if (graphConfig.xAxis?.field && enrichedConfig.xAxis?.label) {
			newTitle = newTitle.replace(new RegExp(escapeRegex(graphConfig.xAxis.field), 'g'), enrichedConfig.xAxis.label);
		}
		
		// Substituir campo do yAxis no título
		if (graphConfig.yAxis?.field && enrichedConfig.yAxis?.label) {
			newTitle = newTitle.replace(new RegExp(escapeRegex(graphConfig.yAxis.field), 'g'), enrichedConfig.yAxis.label);
		}
		
		// Substituir campos das series no título
		if (enrichedConfig.series) {
			enrichedConfig.series.forEach(serie => {
				if (serie.field && serie.label) {
					newTitle = newTitle.replace(new RegExp(escapeRegex(serie.field), 'g'), serie.label);
				}
			});
		}
		
		// Substituir categoryField no título
		if (graphConfig.categoryField && enrichedConfig.categoryFieldLabel) {
			newTitle = newTitle.replace(new RegExp(escapeRegex(graphConfig.categoryField), 'g'), enrichedConfig.categoryFieldLabel);
		}
		
		// Traduzir termos de agregação e conectivos
		newTitle = translateTitle(newTitle, lang);
		
		enrichedConfig.title = newTitle;
	}

	return enrichedConfig;
}
