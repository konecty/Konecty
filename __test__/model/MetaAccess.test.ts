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
				hidePivotsFromMenu: ['Pivot1', 456, 'Pivot3'],
			};

			const result = MetaAccessSchema.safeParse(invalidAccess);
			expect(result.success).toBe(false);
		});
	});

	describe('both properties together', () => {
		it('should accept both properties with valid arrays', () => {
			const validAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['List1', 'List2'],
				hidePivotsFromMenu: ['Pivot1', 'Pivot2'],
			};

			const result = MetaAccessSchema.safeParse(validAccess);
			expect(result.success).toBe(true);
		});

		it('should maintain backward compatibility with existing access objects', () => {
			const existingAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				isReadable: true,
				isCreatable: true,
				isUpdatable: true,
				isDeletable: false,
			};

			const result = MetaAccessSchema.safeParse(existingAccess);
			expect(result.success).toBe(true);
		});
	});
}); 