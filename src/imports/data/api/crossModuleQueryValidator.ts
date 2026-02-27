import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { CrossModuleQuerySchema, MAX_NESTING_DEPTH, MAX_RELATIONS, type CrossModuleQuery, type CrossModuleRelation } from '@imports/types/crossModuleQuery';
import type { KonFilter } from '@imports/model/Filter';

interface LookupResolution {
	parentDocument: string;
	childDocument: string;
	lookupField: string;
	parentKey: string;
	childKey: string;
}

interface ValidationResult {
	success: true;
	query: CrossModuleQuery;
}

interface ValidationError {
	success: false;
	errors: Array<{ message: string }>;
}

export function validateCrossModuleQuery(body: unknown): ValidationResult | ValidationError {
	const parsed = CrossModuleQuerySchema.safeParse(body);

	if (!parsed.success) {
		const messages = parsed.error.issues.map(issue => ({
			message: `${issue.path.join('.')}: ${issue.message}`,
		}));
		return { success: false, errors: messages };
	}

	const query = parsed.data;

	const meta = MetaObject.Meta[query.document];
	if (meta == null) {
		return { success: false, errors: [{ message: `Document '${query.document}' not found in metadata` }] };
	}

	if (meta.type !== 'document' && meta.type !== 'composite') {
		return { success: false, errors: [{ message: `Document '${query.document}' is not a queryable module (type: ${meta.type})` }] };
	}

	const relationErrors = validateRelationsRecursive(query.document, query.relations, 0);
	if (relationErrors.length > 0) {
		return { success: false, errors: relationErrors.map(message => ({ message })) };
	}

	return { success: true, query };
}

function validateRelationsRecursive(parentDocument: string, relations: CrossModuleRelation[], depth: number): string[] {
	const errors: string[] = [];

	if (depth > MAX_NESTING_DEPTH) {
		errors.push(`Maximum nesting depth of ${MAX_NESTING_DEPTH} exceeded`);
		return errors;
	}

	const totalRelations = countTotalRelations(relations);
	if (totalRelations > MAX_RELATIONS) {
		errors.push(`Total relations count (${totalRelations}) exceeds maximum of ${MAX_RELATIONS}`);
		return errors;
	}

	for (const relation of relations) {
		const relationMeta = MetaObject.Meta[relation.document];
		if (relationMeta == null) {
			errors.push(`Relation document '${relation.document}' not found in metadata`);
			continue;
		}

		const resolution = resolveRelationLookup(parentDocument, relation);
		if (resolution == null) {
			errors.push(`Lookup field '${relation.lookup}' in '${relation.document}' is not a valid lookup pointing to '${parentDocument}'`);
			continue;
		}

		for (const [fieldName, aggregator] of Object.entries(relation.aggregators)) {
			if (aggregator.aggregator !== 'count' && aggregator.aggregator !== 'first' && aggregator.aggregator !== 'last' && aggregator.aggregator !== 'push') {
				if (aggregator.field == null) {
					errors.push(`Aggregator '${aggregator.aggregator}' on field '${fieldName}' requires a 'field' property`);
				}
			}
		}

		if (relation.relations != null && relation.relations.length > 0) {
			const subErrors = validateRelationsRecursive(relation.document, relation.relations, depth + 1);
			errors.push(...subErrors);
		}
	}

	return errors;
}

function countTotalRelations(relations: CrossModuleRelation[]): number {
	let count = relations.length;
	for (const relation of relations) {
		if (relation.relations != null) {
			count += countTotalRelations(relation.relations);
		}
	}
	return count;
}

export function resolveRelationLookup(parentDocument: string, relation: CrossModuleRelation): LookupResolution | null {
	if (relation.on != null) {
		return {
			parentDocument,
			childDocument: relation.document,
			lookupField: relation.lookup,
			parentKey: relation.on.left,
			childKey: relation.on.right,
		};
	}

	const relationMeta = MetaObject.Meta[relation.document];
	if (relationMeta == null) {
		logger.warn({ document: relation.document }, 'Relation document not found in metadata');
		return null;
	}

	const field = relationMeta.fields?.[relation.lookup];
	if (field == null) {
		logger.warn({ document: relation.document, lookup: relation.lookup }, 'Lookup field not found in relation metadata');
		return null;
	}

	if (field.type !== 'lookup' && field.type !== 'inheritLookup') {
		logger.warn({ document: relation.document, lookup: relation.lookup, type: field.type }, 'Field is not a lookup type');
		return null;
	}

	if (field.document !== parentDocument) {
		logger.warn(
			{ document: relation.document, lookup: relation.lookup, expected: parentDocument, got: field.document },
			'Lookup field points to different document than parent',
		);
		return null;
	}

	return {
		parentDocument,
		childDocument: relation.document,
		lookupField: relation.lookup,
		parentKey: '_id',
		childKey: `${relation.lookup}._id`,
	};
}

export function buildRelationFilter(parentIds: string[], lookupResolution: LookupResolution, relationFilter?: KonFilter, readFilter?: KonFilter): KonFilter {
	const conditions: KonFilter['conditions'] = [{ term: lookupResolution.childKey, operator: 'in', value: parentIds }];

	const filters: KonFilter[] = [];

	if (relationFilter?.conditions != null) {
		filters.push(relationFilter);
	}

	if (readFilter?.conditions != null) {
		filters.push(readFilter);
	}

	return {
		match: 'and',
		conditions,
		filters: filters.length > 0 ? filters : undefined,
	};
}
