// @ts-expect-error bun:test é reconhecido apenas pelo runner do Bun
import { describe, it, expect } from 'bun:test';

import { MetaAccess } from '../../../src/imports/model/MetaAccess';
import { shouldFilterListFromMenu, shouldFilterPivotFromMenu, shouldFilterMetaObjectFromMenu } from '../../../src/imports/utils/menuFilteringUtils';

describe('Menu Filtering Logic', () => {
	describe('shouldFilterListFromMenu', () => {
		it('should return false when access has no hideListsFromMenu property', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			} as MetaAccess;

			const listName = 'MyList';
			const shouldFilter = shouldFilterListFromMenu(access, listName);
			expect(shouldFilter).toBe(false);
		});

		it('should return false when hideListsFromMenu is empty array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: [],
			} as MetaAccess;

			const listName = 'MyList';
			const shouldFilter = shouldFilterListFromMenu(access, listName);
			expect(shouldFilter).toBe(false);
		});

		it('should return true when list name is in hideListsFromMenu array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList', 'AnotherList'],
			} as MetaAccess;

			const listName = 'MyList';
			const shouldFilter = shouldFilterListFromMenu(access, listName);
			expect(shouldFilter).toBe(true);
		});

		it('should return false when list name is not in hideListsFromMenu array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['AnotherList', 'ThirdList'],
			} as MetaAccess;

			const listName = 'MyList';
			const shouldFilter = shouldFilterListFromMenu(access, listName);
			expect(shouldFilter).toBe(false);
		});

		it('should be case sensitive', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
			} as MetaAccess;

			const listName = 'mylist';
			const shouldFilter = shouldFilterListFromMenu(access, listName);
			expect(shouldFilter).toBe(false);
		});
	});

	describe('shouldFilterPivotFromMenu', () => {
		it('should return false when access has no hidePivotsFromMenu property', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			} as MetaAccess;

			const pivotName = 'MyPivot';
			const shouldFilter = shouldFilterPivotFromMenu(access, pivotName);
			expect(shouldFilter).toBe(false);
		});

		it('should return false when hidePivotsFromMenu is empty array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: [],
			} as MetaAccess;

			const pivotName = 'MyPivot';
			const shouldFilter = shouldFilterPivotFromMenu(access, pivotName);
			expect(shouldFilter).toBe(false);
		});

		it('should return true when pivot name is in hidePivotsFromMenu array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['MyPivot', 'AnotherPivot'],
			} as MetaAccess;

			const pivotName = 'MyPivot';
			const shouldFilter = shouldFilterPivotFromMenu(access, pivotName);
			expect(shouldFilter).toBe(true);
		});

		it('should return false when pivot name is not in hidePivotsFromMenu array', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['AnotherPivot', 'ThirdPivot'],
			} as MetaAccess;

			const pivotName = 'MyPivot';
			const shouldFilter = shouldFilterPivotFromMenu(access, pivotName);
			expect(shouldFilter).toBe(false);
		});

		it('should be case sensitive', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['MyPivot'],
			} as MetaAccess;

			const pivotName = 'mypivot';
			const shouldFilter = shouldFilterPivotFromMenu(access, pivotName);
			expect(shouldFilter).toBe(false);
		});
	});

	describe('shouldFilterMetaObjectFromMenu', () => {
		it('should return false for non-list and non-pivot types', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
				hidePivotsFromMenu: ['MyPivot'],
			} as MetaAccess;

			const documentMetaObject = {
				type: 'document',
				name: 'TestDocument',
			};

			const shouldFilter = shouldFilterMetaObjectFromMenu(access, documentMetaObject);
			expect(shouldFilter).toBe(false);
		});

		it('should filter list when name is in hideListsFromMenu', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
				hidePivotsFromMenu: ['MyPivot'],
			} as MetaAccess;

			const listMetaObject = {
				type: 'list',
				name: 'MyList',
			};

			const shouldFilter = shouldFilterMetaObjectFromMenu(access, listMetaObject);
			expect(shouldFilter).toBe(true);
		});

		it('should not filter list when name is not in hideListsFromMenu', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['AnotherList'],
				hidePivotsFromMenu: ['MyPivot'],
			} as MetaAccess;

			const listMetaObject = {
				type: 'list',
				name: 'MyList',
			};

			const shouldFilter = shouldFilterMetaObjectFromMenu(access, listMetaObject);
			expect(shouldFilter).toBe(false);
		});

		it('should filter pivot when name is in hidePivotsFromMenu', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
				hidePivotsFromMenu: ['MyPivot'],
			} as MetaAccess;

			const pivotMetaObject = {
				type: 'pivot',
				name: 'MyPivot',
			};

			const shouldFilter = shouldFilterMetaObjectFromMenu(access, pivotMetaObject);
			expect(shouldFilter).toBe(true);
		});

		it('should not filter pivot when name is not in hidePivotsFromMenu', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
				hidePivotsFromMenu: ['AnotherPivot'],
			} as MetaAccess;

			const pivotMetaObject = {
				type: 'pivot',
				name: 'MyPivot',
			};

			const shouldFilter = shouldFilterMetaObjectFromMenu(access, pivotMetaObject);
			expect(shouldFilter).toBe(false);
		});
	});
}); 