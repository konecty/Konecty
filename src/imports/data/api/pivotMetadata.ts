import { MetaObject } from '@imports/model/MetaObject';
import { getLabel } from '@imports/meta/metaUtils';
import type { PivotConfig, PivotEnrichedConfig, PivotRowMeta, PivotColumnMeta, PivotValueMeta, LookupDisplayConfig, PicklistOption, DateBucket } from '@imports/types/pivot';

/**
 * Separar descriptionFields em campos simples e aninhados
 */
function parseDescriptionFields(descriptionFields: string[]): {
	simple: string[];
	nested: string[];
} {
	return {
		simple: descriptionFields.filter(f => !f.includes('.')),
		nested: descriptionFields.filter(f => f.includes('.')),
	};
}

/**
 * Montar padrão de formatação para lookup seguindo o padrão do legado
 * O legado junta descriptionFields + searchableFields com " - "
 * Ex: ["name", "active"] -> "{name} - {active}"
 */
function buildFormatPattern(simpleFields: string[]): string {
	if (simpleFields.length === 0) {
		return '';
	}
	if (simpleFields.length === 1) {
		return `{${simpleFields[0]}}`;
	}
	// Legacy joins with " - " and wraps nested in parentheses
	return simpleFields.map(f => `{${f}}`).join(' - ');
}

/**
 * Resolver campo de lookup para exibição, navegando recursivamente pelos lookups aninhados
 * Segue o padrão do legado que usa descriptionFields + searchableFields
 */
function resolveLookupDisplayField(document: string, fieldPath: string, lang: string = 'pt_BR'): LookupDisplayConfig | null {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return null;
	}

	const parts = fieldPath.split('.');
	const fieldName = parts[0];
	const field = meta.fields[fieldName];

	if (field == null) {
		return null;
	}

	// Se é o último nível e é lookup, montar config
	if (parts.length === 1 && (field.type === 'lookup' || field.type === 'inheritLookup')) {
		// For display in pivot, use ONLY descriptionFields (not searchableFields)
		// The legacy Format.lookup uses descriptionFields for label formatting
		// Special case: _user field uses only 'name' (see Container.js line 671-680)
		// Other fields use all descriptionFields (e.g., Contact: ['code', 'name.full'])
		const descriptionFields = field.descriptionFields || ['name'];
		const { simple, nested } = parseDescriptionFields(descriptionFields);

		// Special handling for _user field: use only 'name'
		if (fieldName === '_user' && simple.includes('name')) {
			return {
				document: field.document || '',
				displayField: 'name',
				formatPattern: '{name}',
				simpleFields: ['name'],
				nestedFields: [],
			};
		}

		return {
			document: field.document || '',
			displayField: simple[0] || nested[0]?.split('.')[0] || 'name',
			formatPattern: buildFormatPattern(simple),
			simpleFields: simple.length > 0 ? simple : ['name'],
			nestedFields: nested,
		};
	}

	// Campo aninhado - navegar recursivamente
	if ((field.type === 'lookup' || field.type === 'inheritLookup') && field.document) {
		const remainingPath = parts.slice(1).join('.');
		return resolveLookupDisplayField(field.document, remainingPath, lang);
	}

	// Campo composto (ex: amount.value)
	if (field.type === 'money' && parts[1] === 'value') {
		return null; // Não é lookup, não precisa de config especial
	}

	return null;
}

/**
 * Resolver metadados de um campo (label, type, etc) concatenando labels dos campos pais
 */
function resolveFieldMeta(document: string, fieldPath: string, lang: string = 'pt_BR'): {
	label: string;
	type: string;
	options?: PicklistOption[];
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

		// Se é picklist, extrair opções
		let options: PicklistOption[] | undefined;
		if (field.type === 'picklist' && field.options) {
			options = Object.entries(field.options).map(([key, optionLabels]) => ({
				key,
				label: getLabel(optionLabels as { label?: Record<string, string> }, lang),
			}));
		}

		return { label, type, options };
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
			options: childMeta.options,
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
 * Verifica se um campo é do tipo data (date ou dateTime)
 */
function isDateField(document: string, fieldPath: string): boolean {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return false;
	}

	const parts = fieldPath.split('.');
	const fieldName = parts[0];
	const field = meta.fields[fieldName];

	if (field == null) {
		return false;
	}

	if (parts.length === 1) {
		return field.type === 'date' || field.type === 'dateTime';
	}

	// Navigate through lookups
	if ((field.type === 'lookup' || field.type === 'inheritLookup') && field.document) {
		return isDateField(field.document, parts.slice(1).join('.'));
	}

	return false;
}

/**
 * Enriquecer configuração de pivot com metadados
 */
export function enrichPivotConfig(document: string, pivotConfig: PivotConfig, lang: string = 'pt_BR'): PivotEnrichedConfig {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		throw new Error(`Document ${document} not found in MetaObject.Meta`);
	}

	// Enriquecer rows
	const enrichedRows: PivotRowMeta[] = pivotConfig.rows.map((row, index) => {
		const fieldMeta = resolveFieldMeta(document, row.field, lang);
		const lookupConfig = resolveLookupDisplayField(document, row.field, lang);

		return {
			field: row.field,
			label: fieldMeta.label,
			type: fieldMeta.type,
			level: index,
			lookup: lookupConfig || undefined,
		};
	});

	// Enriquecer columns (se existirem)
	const enrichedColumns: PivotColumnMeta[] | undefined = pivotConfig.columns?.map(column => {
		const fieldMeta = resolveFieldMeta(document, column.field, lang);
		const lookupConfig = resolveLookupDisplayField(document, column.field, lang);
		
		// Determine bucket from column config if it's a date field
		let bucket: DateBucket | undefined;
		if (column.aggregator && isDateField(document, column.field)) {
			bucket = column.aggregator;
		}

		return {
			field: column.field,
			label: fieldMeta.label,
			type: fieldMeta.type,
			values: fieldMeta.options,
			lookup: lookupConfig || undefined,
			bucket,
		};
	});

	// Enriquecer values
	const enrichedValues: PivotValueMeta[] = pivotConfig.values.map(value => {
		const fieldMeta = resolveFieldMeta(document, value.field, lang);

		// Determinar formato baseado no tipo ou configuração
		let format: string | undefined = value.format;
		if (!format && (fieldMeta.type === 'money' || fieldMeta.type === 'currency')) {
			format = 'currency';
		}

		return {
			field: value.field,
			aggregator: value.aggregator,
			label: fieldMeta.label,
			type: fieldMeta.type,
			format,
		};
	});

	return {
		rows: enrichedRows,
		columns: enrichedColumns,
		values: enrichedValues,
		options: pivotConfig.options,
	};
}
