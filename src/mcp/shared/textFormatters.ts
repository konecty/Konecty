const DEFAULT_MAX_RECORDS = 10;
const DEFAULT_MAX_VALUE_LENGTH = 120;
const DEFAULT_MAX_KEYS = 8;

type RecordFormatOptions = {
	maxRecords?: number;
	keyFields?: string[];
	maxValueLength?: number;
	maxKeys?: number;
};

type KeyValueFormatOptions = {
	maxDepth?: number;
	maxValueLength?: number;
	maxKeys?: number;
};

type WriteConfirmationOptions = {
	maxValueLength?: number;
	maxKeys?: number;
};

function stringifyScalar(value: unknown): string {
	if (value == null) {
		return 'null';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function truncateValue(value: string, maxValueLength: number): string {
	if (value.length <= maxValueLength) {
		return value;
	}
	return `${value.slice(0, maxValueLength)}...`;
}

function pickKeys(record: Record<string, unknown>, keyFields: string[] | undefined, maxKeys: number): string[] {
	const preferred = keyFields?.filter(field => field in record) ?? [];
	if (preferred.length > 0) {
		return preferred.slice(0, maxKeys);
	}

	const keys = Object.keys(record).filter(key => record[key] != null);
	const priority = ['_id', 'name', 'code', 'email', 'status', '_updatedAt'];
	const ordered = [
		...priority.filter(key => keys.includes(key)),
		...keys.filter(key => !priority.includes(key)),
	];
	return ordered.slice(0, maxKeys);
}

function formatPairs(record: Record<string, unknown>, keys: string[], maxValueLength: number, separator: string): string {
	const pairs = keys.map(key => `${key}: ${truncateValue(stringifyScalar(record[key]), maxValueLength)}`);
	return pairs.join(separator);
}

function formatValueByDepth(value: unknown, depth: number, maxDepth: number, maxValueLength: number): string {
	if (value == null) {
		return 'null';
	}
	if (depth >= maxDepth) {
		return truncateValue(stringifyScalar(value), maxValueLength);
	}

	if (Array.isArray(value)) {
		const preview = value.slice(0, 5).map(item => formatValueByDepth(item, depth + 1, maxDepth, maxValueLength)).join(', ');
		const suffix = value.length > 5 ? `, ... (+${value.length - 5} more)` : '';
		return `[${preview}${suffix}]`;
	}

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);
		const preview = keys
			.slice(0, 6)
			.map(key => `${key}: ${formatValueByDepth(obj[key], depth + 1, maxDepth, maxValueLength)}`)
			.join(', ');
		const suffix = keys.length > 6 ? `, ... (+${keys.length - 6} keys)` : '';
		return `{ ${preview}${suffix} }`;
	}

	return truncateValue(stringifyScalar(value), maxValueLength);
}

export function formatRecordList(records: Array<Record<string, unknown>>, options?: RecordFormatOptions): string {
	if (records.length === 0) {
		return 'No records returned.';
	}

	const maxRecords = options?.maxRecords ?? DEFAULT_MAX_RECORDS;
	const maxValueLength = options?.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH;
	const maxKeys = options?.maxKeys ?? DEFAULT_MAX_KEYS;
	const visible = records.slice(0, maxRecords);

	const lines = visible.map((record, index) => {
		const keys = pickKeys(record, options?.keyFields, maxKeys);
		const body = formatPairs(record, keys, maxValueLength, ' | ');
		return `${index + 1}. ${body}`;
	});

	if (records.length > maxRecords) {
		lines.push(`... and ${records.length - maxRecords} more record(s).`);
	}

	return lines.join('\n');
}

export function formatRecord(record: Record<string, unknown>, options?: { exclude?: string[]; maxValueLength?: number; maxKeys?: number }): string {
	const exclude = new Set(options?.exclude ?? []);
	const maxValueLength = options?.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH;
	const maxKeys = options?.maxKeys ?? DEFAULT_MAX_KEYS;
	const keys = pickKeys(record, undefined, maxKeys).filter(key => !exclude.has(key));

	if (keys.length === 0) {
		return 'Record has no displayable fields.';
	}

	return formatPairs(record, keys, maxValueLength, '\n');
}

export function formatModuleList(modules: Array<{ document: string; label: string }>): string {
	if (modules.length === 0) {
		return 'No accessible modules found.';
	}

	const lines = modules.map((module, index) => `${index + 1}. document: ${module.document} | label: ${module.label}`);
	return lines.join('\n');
}

export function formatWriteConfirmation(action: string, document: string, data: Record<string, unknown>, options?: WriteConfirmationOptions): string {
	const maxValueLength = options?.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH;
	const maxKeys = options?.maxKeys ?? 5;
	const keys = pickKeys(data, ['_id', '_updatedAt', 'name', 'code'], maxKeys);
	const details = keys.length > 0 ? `\n${formatPairs(data, keys, maxValueLength, ' | ')}` : '';
	return `${action} ${document} successfully.${details}`;
}

export function formatKeyValues(obj: Record<string, unknown>, options?: KeyValueFormatOptions): string {
	const maxDepth = options?.maxDepth ?? 1;
	const maxValueLength = options?.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH;
	const maxKeys = options?.maxKeys ?? DEFAULT_MAX_KEYS;
	const keys = Object.keys(obj).slice(0, maxKeys);

	if (keys.length === 0) {
		return 'No fields returned.';
	}

	const lines = keys.map(key => `${key}: ${formatValueByDepth(obj[key], 0, maxDepth, maxValueLength)}`);
	if (Object.keys(obj).length > maxKeys) {
		lines.push(`... and ${Object.keys(obj).length - maxKeys} more field(s).`);
	}

	return lines.join('\n');
}

export function appendNextSteps(text: string, steps: string[]): string {
	if (steps.length === 0) {
		return text;
	}

	const nextSteps = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
	return `${text}\n\nNext steps:\n${nextSteps}`;
}
