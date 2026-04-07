import { Parser } from 'node-sql-parser';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import type { KonFilter, KonCondition } from '@imports/model/Filter';
import type { CrossModuleQuery } from '@imports/types/crossModuleQuery';
import { MAX_RELATION_LIMIT, DEFAULT_PRIMARY_LIMIT } from '@imports/types/crossModuleQuery';

const SUPPORTED_AGGREGATES = new Set(['count', 'sum', 'avg', 'min', 'max', 'first', 'last', 'push', 'addtoset']);
const MAX_SQL_LENGTH = 10_000;

const AGGREGATE_NAME_MAP: Record<string, string> = {
	count: 'count',
	sum: 'sum',
	avg: 'avg',
	min: 'min',
	max: 'max',
	first: 'first',
	last: 'last',
	push: 'push',
	addtoset: 'addToSet',
};

const SQL_OPERATOR_MAP: Record<string, string> = {
	'=': 'equals',
	'!=': 'not_equals',
	'<>': 'not_equals',
	'<': 'less_than',
	'>': 'greater_than',
	'<=': 'less_or_equals',
	'>=': 'greater_or_equals',
	IN: 'in',
	'NOT IN': 'not_in',
	LIKE: 'contains',
	'IS NULL': 'equals',
	'IS NOT NULL': 'not_equals',
};

export class SqlParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SqlParseError';
	}
}

interface AliasMap {
	[alias: string]: string;
}

interface RelationInfo {
	document: string;
	lookup: string;
	parentAlias: string;
	alias: string;
	filter?: KonFilter;
	fields?: string;
	sort?: Array<{ property: string; direction: 'ASC' | 'DESC' }>;
	limit?: number;
	aggregators: Record<string, { aggregator: string; field?: string }>;
	subRelations: RelationInfo[];
	explicitOn?: { left: string; right: string };
}

export function sqlToIQR(sql: string): CrossModuleQuery {
	if (sql.length > MAX_SQL_LENGTH) {
		throw new SqlParseError(`SQL query exceeds maximum length of ${MAX_SQL_LENGTH} characters`);
	}

	const parser = new Parser();
	let ast: any;

	try {
		ast = parser.astify(sql, { database: 'MySQL' });
	} catch (err) {
		throw new SqlParseError(`SQL syntax error: ${(err as Error).message}`);
	}

	if (Array.isArray(ast)) {
		if (ast.length !== 1) {
			throw new SqlParseError('Only a single SQL statement is allowed');
		}
		ast = ast[0];
	}

	if (ast.type !== 'select') {
		throw new SqlParseError('Only SELECT queries are allowed');
	}

	validateNoUnsupportedFeatures(ast);

	const aliasMap = buildAliasMap(ast);
	const primaryAlias = getPrimaryAlias(ast);
	const primaryDocument = aliasMap[primaryAlias];

	const relations = buildRelations(ast, aliasMap, primaryAlias);
	assignAggregators(ast, aliasMap, primaryAlias, relations);
	assignFields(ast, aliasMap, primaryAlias, relations);
	assignWhereFilters(ast, aliasMap, primaryAlias, relations);

	const sort = buildSort(ast, aliasMap);
	const { limit, start } = buildLimitOffset(ast);

	const primaryFields = getPrimaryFields(ast, aliasMap, primaryAlias);

	const iqr: CrossModuleQuery = {
		document: primaryDocument,
		relations: relations.map(r => buildRelationOutput(r)),
		limit: limit ?? DEFAULT_PRIMARY_LIMIT,
		start: start ?? 0,
		includeTotal: false,
		includeMeta: true,
	} as CrossModuleQuery;

	if (primaryFields != null) {
		(iqr as any).fields = primaryFields;
	}

	const primaryFilter = buildPrimaryFilter(ast, aliasMap, primaryAlias);
	if (primaryFilter != null) {
		(iqr as any).filter = primaryFilter;
	}

	if (sort != null && sort.length > 0) {
		(iqr as any).sort = sort;
	}

	logger.debug({ document: primaryDocument, relationsCount: relations.length }, '[sqlToIQR] Translated SQL to IQR');

	return iqr;
}

function validateNoUnsupportedFeatures(ast: any): void {
	if (ast.with != null) {
		throw new SqlParseError('Unsupported SQL feature: WITH (CTE) clause');
	}
	if (ast.union != null || ast._next != null) {
		throw new SqlParseError('Unsupported SQL feature: UNION');
	}
	if (ast.having != null) {
		throw new SqlParseError('HAVING clause is not yet supported');
	}

	const where = ast.where;
	if (where != null) {
		checkForSubqueries(where);
	}
}

function checkForSubqueries(node: any): void {
	if (node == null) return;
	if (node.type === 'select' || node.ast?.type === 'select') {
		throw new SqlParseError('Unsupported SQL feature: subquery');
	}
	if (node.left != null) checkForSubqueries(node.left);
	if (node.right != null) checkForSubqueries(node.right);
	if (node.value?.type === 'select') {
		throw new SqlParseError('Unsupported SQL feature: subquery');
	}
	if (node.type === 'expr_list' && Array.isArray(node.value)) {
		for (const item of node.value) {
			if (item?.ast?.type === 'select' || item?.type === 'select') {
				throw new SqlParseError('Unsupported SQL feature: subquery');
			}
		}
	}
}

function buildAliasMap(ast: any): AliasMap {
	const aliasMap: AliasMap = {};

	const fromTables = Array.isArray(ast.from) ? ast.from : [ast.from];
	for (const table of fromTables) {
		if (table == null) continue;
		const tableName = table.table;
		const alias = table.as ?? tableName;

		validateTable(tableName);
		aliasMap[alias] = tableName;

		if (table.join != null) {
			processJoinForAlias(table, aliasMap);
		}
	}

	return aliasMap;
}

function processJoinForAlias(node: any, aliasMap: AliasMap): void {
	if (node.join == null) return;
	const tableName = node.table;
	const alias = node.as ?? tableName;
	validateTable(tableName);
	aliasMap[alias] = tableName;
}

function validateTable(tableName: string): void {
	const meta = MetaObject.Meta[tableName];
	if (meta == null) {
		throw new SqlParseError(`Unknown table '${tableName}'. Table must exist in Konecty metadata.`);
	}
	if (meta.type !== 'document' && meta.type !== 'composite') {
		throw new SqlParseError(`Table '${tableName}' is not a queryable module (type: ${meta.type})`);
	}
}

function getPrimaryAlias(ast: any): string {
	const fromTables = Array.isArray(ast.from) ? ast.from : [ast.from];
	const primary = fromTables[0];
	if (primary == null) {
		throw new SqlParseError('No FROM clause found');
	}
	return primary.as ?? primary.table;
}

function buildRelations(ast: any, aliasMap: AliasMap, primaryAlias: string): RelationInfo[] {
	const fromTables = Array.isArray(ast.from) ? ast.from : [ast.from];
	const relations: RelationInfo[] = [];
	const relationsByAlias = new Map<string, RelationInfo>();

	for (let i = 1; i < fromTables.length; i++) {
		const joinNode = fromTables[i];
		if (joinNode == null) continue;

		const joinType = (joinNode.join ?? '').toUpperCase();
		if (joinType.includes('RIGHT')) {
			throw new SqlParseError('RIGHT JOIN is not supported. Use LEFT JOIN or INNER JOIN.');
		}
		if (joinType.includes('CROSS')) {
			throw new SqlParseError('Unsupported SQL feature: CROSS JOIN');
		}

		const childAlias = joinNode.as ?? joinNode.table;
		const childDocument = aliasMap[childAlias];

		const joinLookup = inferJoinLookup(joinNode.on, aliasMap, childAlias);

		const parentDocument = aliasMap[joinLookup.parentAlias];
		if (parentDocument == null) {
			throw new SqlParseError(`Cannot resolve parent table for JOIN on '${childDocument}'`);
		}

		const relationInfo: RelationInfo = {
			document: childDocument,
			lookup: joinLookup.lookupField,
			parentAlias: joinLookup.parentAlias,
			alias: childAlias,
			aggregators: {},
			subRelations: [],
			explicitOn: joinLookup.explicitOn,
		};

		relationsByAlias.set(childAlias, relationInfo);

		if (joinLookup.parentAlias === primaryAlias) {
			relations.push(relationInfo);
		} else {
			const parentRelation = relationsByAlias.get(joinLookup.parentAlias);
			if (parentRelation != null) {
				parentRelation.subRelations.push(relationInfo);
			} else {
				relations.push(relationInfo);
			}
		}
	}

	return relations;
}

function inferJoinLookup(onExpr: any, aliasMap: AliasMap, childAlias: string): { parentAlias: string; lookupField: string; explicitOn?: { left: string; right: string } } {
	if (onExpr == null) {
		throw new SqlParseError('JOIN must have an ON clause');
	}

	const left = extractColumnRef(onExpr.left);
	const right = extractColumnRef(onExpr.right);

	if (left == null || right == null) {
		throw new SqlParseError('JOIN ON clause must compare two column references (e.g. a._id = b.lookup._id)');
	}

	if (left.column === '_id' && right.column.endsWith('._id')) {
		const lookupField = right.column.replace(/\._id$/, '');
		if (right.table === childAlias) {
			return { parentAlias: left.table, lookupField };
		}
		return {
			parentAlias: right.table,
			lookupField,
			explicitOn: { left: right.column, right: '_id' },
		};
	}

	if (right.column === '_id' && left.column.endsWith('._id')) {
		const lookupField = left.column.replace(/\._id$/, '');
		if (left.table === childAlias) {
			return { parentAlias: right.table, lookupField };
		}
		return {
			parentAlias: left.table,
			lookupField,
			explicitOn: { left: left.column, right: '_id' },
		};
	}

	const childDocument = aliasMap[childAlias];
	const childMeta = MetaObject.Meta[childDocument];
	if (childMeta?.fields != null) {
		for (const [fieldName, fieldDef] of Object.entries(childMeta.fields)) {
			if ((fieldDef as any).type === 'lookup' || (fieldDef as any).type === 'inheritLookup') {
				const otherAlias = childAlias === left.table ? right.table : left.table;
				const otherDoc = aliasMap[otherAlias];
				if ((fieldDef as any).document === otherDoc) {
					return { parentAlias: otherAlias, lookupField: fieldName };
				}
			}
		}
	}

	throw new SqlParseError(`Cannot infer lookup from JOIN ON clause. Expected pattern: parent._id = child.lookupField._id`);
}

function extractColumnRef(node: any): { table: string; column: string } | null {
	if (node == null) return null;

	if (node.type === 'column_ref') {
		const rawColumn = node.column?.expr?.value ?? node.column;

		if (typeof rawColumn !== 'string') return null;

		if (node.db != null && node.db !== '') {
			const alias = node.db;
			const nestedTable = node.table ?? '';
			const column = nestedTable !== '' ? `${nestedTable}.${rawColumn}` : rawColumn;
			return { table: alias, column };
		}

		const table = node.table ?? '';
		return { table, column: rawColumn };
	}

	return null;
}

function assignAggregators(ast: any, aliasMap: AliasMap, primaryAlias: string, relations: RelationInfo[]): void {
	const columns = ast.columns;
	if (columns === '*' || !Array.isArray(columns)) return;

	for (const col of columns) {
		const expr = col.expr;
		const alias = col.as;

		const aggInfo = extractAggregateInfo(expr);
		if (aggInfo == null) continue;

		const { aggregatorName, fieldRef, tableAlias } = aggInfo;

		if (alias == null) {
			throw new SqlParseError(`Aggregate function ${aggregatorName.toUpperCase()} requires an AS alias`);
		}

		const relation = findRelationByAlias(relations, tableAlias);
		if (relation == null) {
			if (tableAlias === primaryAlias) {
				throw new SqlParseError(`Aggregate ${aggregatorName.toUpperCase()} references primary table '${tableAlias}'. Aggregates must reference a relation table.`);
			}
			throw new SqlParseError(`Cannot find relation for aggregate on alias '${tableAlias}'`);
		}

		const iqrName = AGGREGATE_NAME_MAP[aggregatorName.toLowerCase()];
		if (iqrName == null) {
			throw new SqlParseError(`Unknown aggregate function: ${aggregatorName}`);
		}

		const aggregator: { aggregator: string; field?: string } = { aggregator: iqrName };
		if (fieldRef != null && fieldRef !== '*' && fieldRef !== '_id') {
			aggregator.field = fieldRef;
		}

		relation.aggregators[alias] = aggregator;
	}
}

function extractAggregateInfo(expr: any): { aggregatorName: string; fieldRef: string | null; tableAlias: string } | null {
	if (expr == null) return null;

	if (expr.type === 'aggr_func') {
		const name = expr.name?.toLowerCase() ?? '';
		const args = expr.args;
		const { tableAlias, fieldRef } = extractAggregateArgs(args);
		return { aggregatorName: name, fieldRef, tableAlias };
	}

	if (expr.type === 'function') {
		const name = (expr.name?.name?.[0]?.value ?? expr.name ?? '').toLowerCase();
		if (SUPPORTED_AGGREGATES.has(name)) {
			const args = expr.args;
			const { tableAlias, fieldRef } = extractFunctionArgs(args);
			return { aggregatorName: name, fieldRef, tableAlias };
		}
	}

	return null;
}

function extractAggregateArgs(args: any): { tableAlias: string; fieldRef: string | null } {
	if (args == null) return { tableAlias: '', fieldRef: null };

	if (args.expr != null) {
		const ref = extractColumnRef(args.expr);
		if (ref != null) {
			return { tableAlias: ref.table, fieldRef: ref.column };
		}
		if (args.expr.type === 'star') {
			const table = args.expr.table ?? '';
			return { tableAlias: table, fieldRef: '*' };
		}
	}

	if (args.type === 'star') {
		return { tableAlias: args.table ?? '', fieldRef: '*' };
	}

	return { tableAlias: '', fieldRef: null };
}

function extractFunctionArgs(args: any): { tableAlias: string; fieldRef: string | null } {
	if (args == null) return { tableAlias: '', fieldRef: null };

	if (args.type === 'expr_list' && Array.isArray(args.value)) {
		for (const arg of args.value) {
			const innerExpr = arg.expr ?? arg;
			const ref = extractColumnRef(innerExpr);
			if (ref != null) {
				return { tableAlias: ref.table, fieldRef: ref.column };
			}
			if (innerExpr.type === 'column_ref' && innerExpr.column === '*') {
				return { tableAlias: innerExpr.table ?? '', fieldRef: '*' };
			}
		}
	}

	const argValue = args.value ?? args;
	if (Array.isArray(argValue)) {
		for (const arg of argValue) {
			const innerExpr = arg.expr ?? arg;
			const ref = extractColumnRef(innerExpr);
			if (ref != null) {
				return { tableAlias: ref.table, fieldRef: ref.column };
			}
		}
	}

	const ref = extractColumnRef(argValue);
	if (ref != null) {
		return { tableAlias: ref.table, fieldRef: ref.column };
	}

	return { tableAlias: '', fieldRef: null };
}

function findRelationByAlias(relations: RelationInfo[], alias: string): RelationInfo | null {
	for (const rel of relations) {
		if (rel.alias === alias) return rel;
		const found = findRelationByAlias(rel.subRelations, alias);
		if (found != null) return found;
	}
	return null;
}

function assignFields(ast: any, aliasMap: AliasMap, primaryAlias: string, relations: RelationInfo[]): void {
	const columns = ast.columns;
	if (columns === '*' || !Array.isArray(columns)) return;

	const fieldsByAlias = new Map<string, string[]>();

	for (const col of columns) {
		const expr = col.expr;
		if (extractAggregateInfo(expr) != null) continue;

		const ref = extractColumnRef(expr);
		if (ref == null) continue;

		const tableAlias = ref.table || primaryAlias;
		const fieldName = ref.column;

		const existing = fieldsByAlias.get(tableAlias) ?? [];
		existing.push(fieldName);
		fieldsByAlias.set(tableAlias, existing);
	}

	for (const [alias, fields] of fieldsByAlias) {
		if (alias === primaryAlias) continue;
		const relation = findRelationByAlias(relations, alias);
		if (relation != null) {
			relation.fields = fields.join(',');
		}
	}
}

function getPrimaryFields(ast: any, aliasMap: AliasMap, primaryAlias: string): string | undefined {
	const columns = ast.columns;
	if (columns === '*' || !Array.isArray(columns)) return undefined;

	const fields: string[] = [];

	for (const col of columns) {
		const expr = col.expr;
		if (extractAggregateInfo(expr) != null) continue;

		const ref = extractColumnRef(expr);
		if (ref == null) continue;

		const tableAlias = ref.table || primaryAlias;
		if (tableAlias === primaryAlias) {
			fields.push(ref.column);
		}
	}

	return fields.length > 0 ? fields.join(',') : undefined;
}

interface FiltersByAlias {
	conditions: Map<string, KonCondition[]>;
	orFilters: Map<string, KonFilter[]>;
}

function collectAllFilters(ast: any, aliasMap: AliasMap, primaryAlias: string): FiltersByAlias {
	const where = ast.where;
	const result: FiltersByAlias = {
		conditions: new Map(),
		orFilters: new Map(),
	};
	if (where == null) return result;

	buildFiltersFromNode(where, aliasMap, primaryAlias, result);
	return result;
}

function buildFiltersFromNode(node: any, aliasMap: AliasMap, primaryAlias: string, result: FiltersByAlias): void {
	if (node == null) return;

	if (node.type === 'binary_expr') {
		const op = (node.operator ?? '').toUpperCase();

		if (op === 'AND') {
			buildFiltersFromNode(node.left, aliasMap, primaryAlias, result);
			buildFiltersFromNode(node.right, aliasMap, primaryAlias, result);
			return;
		}

		if (op === 'OR') {
			const leftAliases = getReferencedAliases(node.left);
			const rightAliases = getReferencedAliases(node.right);
			const allAliases = new Set([...leftAliases, ...rightAliases]);

			if (allAliases.size > 1) {
				throw new SqlParseError('OR conditions across different modules are not supported');
			}

			const leftConditions = new Map<string, KonCondition[]>();
			const rightConditions = new Map<string, KonCondition[]>();
			collectLeafConditions(node.left, aliasMap, primaryAlias, leftConditions);
			collectLeafConditions(node.right, aliasMap, primaryAlias, rightConditions);

			for (const alias of allAliases) {
				const left = leftConditions.get(alias) ?? [];
				const right = rightConditions.get(alias) ?? [];
				const orFilter: KonFilter = {
					match: 'or',
					conditions: [...left, ...right],
				};
				const existing = result.orFilters.get(alias) ?? [];
				existing.push(orFilter);
				result.orFilters.set(alias, existing);
			}
			return;
		}

		const condition = convertBinaryExprToCondition(node, aliasMap, primaryAlias);
		if (condition != null) {
			const existing = result.conditions.get(condition.alias) ?? [];
			existing.push(condition.condition);
			result.conditions.set(condition.alias, existing);
		}
		return;
	}

	const condition = convertBinaryExprToCondition(node, aliasMap, primaryAlias);
	if (condition != null) {
		const existing = result.conditions.get(condition.alias) ?? [];
		existing.push(condition.condition);
		result.conditions.set(condition.alias, existing);
	}
}

function collectLeafConditions(node: any, aliasMap: AliasMap, primaryAlias: string, result: Map<string, KonCondition[]>): void {
	if (node == null) return;

	if (node.type === 'binary_expr') {
		const op = (node.operator ?? '').toUpperCase();
		if (op === 'AND' || op === 'OR') {
			collectLeafConditions(node.left, aliasMap, primaryAlias, result);
			collectLeafConditions(node.right, aliasMap, primaryAlias, result);
			return;
		}
	}

	const condition = convertBinaryExprToCondition(node, aliasMap, primaryAlias);
	if (condition != null) {
		const existing = result.get(condition.alias) ?? [];
		existing.push(condition.condition);
		result.set(condition.alias, existing);
	}
}

function buildKonFilterFromParts(conditions: KonCondition[], orFilters: KonFilter[]): KonFilter {
	const filter: KonFilter = {
		match: 'and',
		conditions: conditions.length > 0 ? conditions : undefined,
	};
	if (orFilters.length > 0) {
		filter.filters = orFilters;
	}
	return filter;
}

function assignWhereFilters(ast: any, aliasMap: AliasMap, primaryAlias: string, relations: RelationInfo[]): void {
	const filters = collectAllFilters(ast, aliasMap, primaryAlias);

	for (const alias of new Set([...filters.conditions.keys(), ...filters.orFilters.keys()])) {
		if (alias === primaryAlias) continue;
		const relation = findRelationByAlias(relations, alias);
		if (relation == null) continue;

		const conditions = filters.conditions.get(alias) ?? [];
		const orFilters = filters.orFilters.get(alias) ?? [];

		if (conditions.length > 0 || orFilters.length > 0) {
			relation.filter = buildKonFilterFromParts(conditions, orFilters);
		}
	}
}

function buildPrimaryFilter(ast: any, aliasMap: AliasMap, primaryAlias: string): KonFilter | undefined {
	const filters = collectAllFilters(ast, aliasMap, primaryAlias);

	const conditions = filters.conditions.get(primaryAlias) ?? [];
	const orFilters = filters.orFilters.get(primaryAlias) ?? [];

	if (conditions.length === 0 && orFilters.length === 0) return undefined;

	return buildKonFilterFromParts(conditions, orFilters);
}

function getReferencedAliases(node: any): Set<string> {
	const aliases = new Set<string>();
	if (node == null) return aliases;

	if (node.type === 'column_ref') {
		if (node.table) aliases.add(node.table);
		return aliases;
	}

	if (node.left) {
		for (const a of getReferencedAliases(node.left)) aliases.add(a);
	}
	if (node.right) {
		for (const a of getReferencedAliases(node.right)) aliases.add(a);
	}
	return aliases;
}

function convertBinaryExprToCondition(node: any, aliasMap: AliasMap, primaryAlias: string): { alias: string; condition: KonCondition } | null {
	if (node == null) return null;

	const op = (node.operator ?? '').toUpperCase();

	if (op === 'IS' || op === 'IS NOT') {
		const ref = extractColumnRef(node.left);
		if (ref == null) return null;

		const alias = ref.table || primaryAlias;
		const isNull = op === 'IS';
		return {
			alias,
			condition: {
				term: ref.column,
				operator: isNull ? 'equals' : 'not_equals',
				value: null,
			},
		};
	}

	if (op === 'IN' || op === 'NOT IN') {
		const ref = extractColumnRef(node.left);
		if (ref == null) return null;

		const alias = ref.table || primaryAlias;
		const values = extractListValues(node.right);
		return {
			alias,
			condition: {
				term: ref.column,
				operator: op === 'IN' ? 'in' : 'not_in',
				value: values,
			},
		};
	}

	if (op === 'BETWEEN') {
		const ref = extractColumnRef(node.left);
		if (ref == null) return null;

		const alias = ref.table || primaryAlias;
		const existing: KonCondition[] = [];
		if (node.right?.value?.[0] != null) {
			existing.push({
				term: ref.column,
				operator: 'greater_or_equals',
				value: extractLiteralValue(node.right.value[0]),
			});
		}
		if (node.right?.value?.[1] != null) {
			existing.push({
				term: ref.column,
				operator: 'less_or_equals',
				value: extractLiteralValue(node.right.value[1]),
			});
		}
		if (existing.length > 0) {
			return { alias, condition: existing[0] };
		}
		return null;
	}

	if (op === 'LIKE') {
		const ref = extractColumnRef(node.left);
		if (ref == null) return null;
		const alias = ref.table || primaryAlias;
		const value = extractLiteralValue(node.right);
		return {
			alias,
			condition: { term: ref.column, operator: 'contains', value },
		};
	}

	const mappedOp = SQL_OPERATOR_MAP[op];
	if (mappedOp == null) return null;

	const ref = extractColumnRef(node.left);
	if (ref == null) return null;

	const alias = ref.table || primaryAlias;
	const value = extractLiteralValue(node.right);

	return {
		alias,
		condition: { term: ref.column, operator: mappedOp, value },
	};
}

function extractLiteralValue(node: any): any {
	if (node == null) return null;

	if (node.type === 'number' || node.type === 'single_quote_string' || node.type === 'string' || node.type === 'bool') {
		return node.value;
	}

	if (node.type === 'null') {
		return null;
	}

	if (typeof node.value !== 'undefined') {
		return node.value;
	}

	return null;
}

function extractListValues(node: any): any[] {
	if (node == null) return [];

	if (node.type === 'expr_list' && Array.isArray(node.value)) {
		return node.value.map((v: any) => extractLiteralValue(v));
	}

	if (Array.isArray(node)) {
		return node.map((v: any) => extractLiteralValue(v));
	}

	return [];
}

function buildSort(ast: any, _aliasMap: AliasMap): Array<{ property: string; direction: 'ASC' | 'DESC' }> | undefined {
	if (ast.orderby == null) return undefined;

	const sortItems: Array<{ property: string; direction: 'ASC' | 'DESC' }> = [];

	for (const item of ast.orderby) {
		const ref = extractColumnRef(item.expr);
		if (ref == null) continue;

		const property = ref.column;
		const direction = (item.type ?? 'ASC').toUpperCase() as 'ASC' | 'DESC';
		sortItems.push({ property, direction });
	}

	return sortItems.length > 0 ? sortItems : undefined;
}

function buildLimitOffset(ast: any): { limit?: number; start?: number } {
	const result: { limit?: number; start?: number } = {};

	if (ast.limit != null) {
		const limitNode = ast.limit;
		const values = limitNode.value;

		if (Array.isArray(values)) {
			if (values.length === 1) {
				result.limit = Math.min(values[0].value, MAX_RELATION_LIMIT);
			} else if (values.length >= 2) {
				if (limitNode.seperator === 'offset') {
					result.limit = Math.min(values[0].value, MAX_RELATION_LIMIT);
					result.start = values[1].value;
				} else {
					result.start = values[0].value;
					result.limit = Math.min(values[1].value, MAX_RELATION_LIMIT);
				}
			}
		} else if (typeof values === 'number') {
			result.limit = Math.min(values, MAX_RELATION_LIMIT);
		}
	}

	return result;
}

function buildRelationOutput(rel: RelationInfo): any {
	const output: any = {
		document: rel.document,
		lookup: rel.lookup,
		aggregators: rel.aggregators,
	};

	if (rel.explicitOn != null) {
		output.on = rel.explicitOn;
	}
	if (rel.filter != null) {
		output.filter = rel.filter;
	}
	if (rel.fields != null) {
		output.fields = rel.fields;
	}
	if (rel.sort != null) {
		output.sort = rel.sort;
	}
	if (rel.limit != null) {
		output.limit = rel.limit;
	}
	if (rel.subRelations.length > 0) {
		output.relations = rel.subRelations.map(sr => buildRelationOutput(sr));
	}

	return output;
}

export function inferLookupFromJoin(
	leftTable: string,
	leftField: string,
	rightTable: string,
	rightField: string,
): { parentDocument: string; childDocument: string; lookupField: string } | null {
	if (leftField === '_id') {
		const childMeta = MetaObject.Meta[rightTable];
		const lookupName = rightField.replace(/\._id$/, '');
		const field = childMeta?.fields?.[lookupName];
		if (field != null && ((field as any).type === 'lookup' || (field as any).type === 'inheritLookup') && (field as any).document === leftTable) {
			return { parentDocument: leftTable, childDocument: rightTable, lookupField: lookupName };
		}
	}

	if (rightField === '_id') {
		const childMeta = MetaObject.Meta[leftTable];
		const lookupName = leftField.replace(/\._id$/, '');
		const field = childMeta?.fields?.[lookupName];
		if (field != null && ((field as any).type === 'lookup' || (field as any).type === 'inheritLookup') && (field as any).document === rightTable) {
			return { parentDocument: rightTable, childDocument: leftTable, lookupField: lookupName };
		}
	}

	return null;
}
