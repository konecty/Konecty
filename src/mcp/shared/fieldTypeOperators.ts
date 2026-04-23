/**
 * Mapping of Konecty field types to their valid filter operators.
 * Derived from filterUtils.js operatoresByType — kept in sync manually.
 * Used by filter_build for operator validation and modules_fields for control field annotation.
 */
export const OPERATORS_BY_FIELD_TYPE: Record<string, readonly string[]> = {
	text: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	url: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'email.address': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	number: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	autoNumber: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	date: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	dateTime: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'money.currency': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'money.value': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	boolean: ['exists', 'equals', 'not_equals'],
	'address.country': ['exists', 'equals', 'not_equals'],
	'address.city': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'address.state': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.district': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.place': ['exists', 'equals', 'not_equals', 'contains'],
	'address.number': ['exists', 'equals', 'not_equals'],
	'address.postalCode': ['exists', 'equals', 'not_equals', 'contains'],
	'address.complement': ['exists', 'equals', 'not_equals', 'contains'],
	'address.geolocation.0': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'address.geolocation.1': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'personName.first': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'personName.last': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'personName.full': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'phone.phoneNumber': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'phone.countryCode': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	picklist: ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	lookup: ['exists'],
	'lookup._id': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	ObjectId: ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	encrypted: ['exists', 'equals', 'not_equals'],
	filter: ['exists'],
	'filter.conditions': ['exists'],
	richText: ['exists', 'contains'],
	file: ['exists'],
	percentage: ['exists', 'equals', 'not_equals', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
};

export type ControlFieldMeta = {
	name: string;
	type: string;
	filterPath: string;
	validOperators: readonly string[];
	dateFormat?: string;
	description: string;
};

export const CONTROL_FIELDS: ControlFieldMeta[] = [
	{
		name: '_id',
		type: 'ObjectId',
		filterPath: '_id',
		validOperators: OPERATORS_BY_FIELD_TYPE['ObjectId'],
		description: 'Unique record identifier',
	},
	{
		name: '_createdAt',
		type: 'dateTime',
		filterPath: '_createdAt',
		validOperators: OPERATORS_BY_FIELD_TYPE['dateTime'],
		dateFormat: 'ISO 8601 (e.g. "2026-03-18T00:00:00Z")',
		description: 'Record creation timestamp',
	},
	{
		name: '_updatedAt',
		type: 'dateTime',
		filterPath: '_updatedAt',
		validOperators: OPERATORS_BY_FIELD_TYPE['dateTime'],
		dateFormat: 'ISO 8601 (e.g. "2026-03-18T00:00:00Z")',
		description: 'Last update timestamp (used for optimistic locking)',
	},
	{
		name: '_user',
		type: 'lookup (User[])',
		filterPath: '_user._id',
		validOperators: OPERATORS_BY_FIELD_TYPE['lookup._id'],
		description: 'Owner users. Also supports operator "current_user" (no value needed)',
	},
	{
		name: '_createdBy',
		type: 'lookup (User)',
		filterPath: '_createdBy._id',
		validOperators: OPERATORS_BY_FIELD_TYPE['lookup._id'],
		description: 'User who created the record',
	},
	{
		name: '_updatedBy',
		type: 'lookup (User)',
		filterPath: '_updatedBy._id',
		validOperators: OPERATORS_BY_FIELD_TYPE['lookup._id'],
		description: 'User who last updated the record',
	},
];

export function getOperatorsForType(fieldType: string): readonly string[] | undefined {
	return OPERATORS_BY_FIELD_TYPE[fieldType];
}

export function formatControlFieldsText(): string {
	const lines = CONTROL_FIELDS.map(f => {
		const ops = f.validOperators.slice(0, 5).join(', ') + (f.validOperators.length > 5 ? '...' : '');
		const dateFmt = f.dateFormat != null ? ` | format: ${f.dateFormat}` : '';
		return `  ${f.name}: type ${f.type}, filter as "${f.filterPath}", operators: ${ops}${dateFmt}`;
	});
	return `Control/system fields (present in all modules):\n${lines.join('\n')}`;
}
