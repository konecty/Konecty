// @ts-expect-error bun:test é reconhecido apenas pelo runner do Bun
import { describe, it, expect } from 'bun:test';

import { MetaAccessSchema } from '../../src/imports/model/MetaAccess';

describe('MetaAccessSchema', () => {
	describe('hideListsFromMenu property', () => {
		it('should accept valid array of strings', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['List1', 'List2', 'List3'],
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should accept empty array', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: [],
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should be optional', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should reject non-array values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: 'not-an-array',
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});

		it('should reject array with non-string values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['List1', 123, 'List3'],
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});
	});

	describe('hidePivotsFromMenu property', () => {
		it('should accept valid array of strings', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['Pivot1', 'Pivot2', 'Pivot3'],
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should accept empty array', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: [],
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should be optional', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should reject non-array values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: 'not-an-array',
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});

		it('should reject array with non-string values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['Pivot1', 123, 'Pivot3'],
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});
	});

	describe('menuSorter property', () => {
		it('should accept valid object with string keys and number values', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {
					Campaign: 0,
					Opportunity: 5,
					Contact: 10,
				},
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should accept empty object', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {},
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should be optional', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should reject non-object values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: 'not-an-object',
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});

		it('should reject object with non-string keys', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {
					'not-a-valid-key': 0,
					Campaign: 5,
				},
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(true); // Zod accepts any string as key
		});

		it('should reject object with non-number values', () => {
			const invalidAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {
					Campaign: 'not-a-number',
					Opportunity: 5,
				},
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});
	});
});
