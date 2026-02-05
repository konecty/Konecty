import { shouldFilterListFromMenu, shouldFilterPivotFromMenu, shouldFilterMetaObjectFromMenu, getMenuSorterFromAccess } from '../../../src/imports/utils/menuFilteringUtils';
import { MetaAccess } from '../../../src/imports/model/MetaAccess';

describe('menuFilteringUtils', () => {
	describe('shouldFilterListFromMenu', () => {
		it('should return false when hideListsFromMenu is not defined', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = shouldFilterListFromMenu(access, 'MyList');
			expect(result).toBe(false);
		});

		it('should return false when hideListsFromMenu is empty', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: [],
			};

			const result = shouldFilterListFromMenu(access, 'MyList');
			expect(result).toBe(false);
		});

		it('should return true when list is in hideListsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList', 'AnotherList'],
			};

			const result = shouldFilterListFromMenu(access, 'MyList');
			expect(result).toBe(true);
		});

		it('should return false when list is not in hideListsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['AnotherList', 'ThirdList'],
			};

			const result = shouldFilterListFromMenu(access, 'MyList');
			expect(result).toBe(false);
		});
	});

	describe('shouldFilterPivotFromMenu', () => {
		it('should return false when hidePivotsFromMenu is not defined', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = shouldFilterPivotFromMenu(access, 'MyPivot');
			expect(result).toBe(false);
		});

		it('should return false when hidePivotsFromMenu is empty', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: [],
			};

			const result = shouldFilterPivotFromMenu(access, 'MyPivot');
			expect(result).toBe(false);
		});

		it('should return true when pivot is in hidePivotsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['MyPivot', 'AnotherPivot'],
			};

			const result = shouldFilterPivotFromMenu(access, 'MyPivot');
			expect(result).toBe(true);
		});

		it('should return false when pivot is not in hidePivotsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['AnotherPivot', 'ThirdPivot'],
			};

			const result = shouldFilterPivotFromMenu(access, 'MyPivot');
			expect(result).toBe(false);
		});
	});

	describe('shouldFilterMetaObjectFromMenu', () => {
		it('should filter list when it is in hideListsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
			};

			const result = shouldFilterMetaObjectFromMenu(access, { type: 'list', name: 'MyList' });
			expect(result).toBe(true);
		});

		it('should filter pivot when it is in hidePivotsFromMenu', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['MyPivot'],
			};

			const result = shouldFilterMetaObjectFromMenu(access, { type: 'pivot', name: 'MyPivot' });
			expect(result).toBe(true);
		});

		it('should not filter other types', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['MyList'],
				hidePivotsFromMenu: ['MyPivot'],
			};

			const result = shouldFilterMetaObjectFromMenu(access, { type: 'document', name: 'MyDocument' });
			expect(result).toBe(false);
		});
	});

	describe('getMenuSorterFromAccess', () => {
		it('should return original menuSorter when access.menuSorter is not defined', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			const result = getMenuSorterFromAccess(access, 'Campaign', 13);
			expect(result).toBe(13);
		});

		it('should return original menuSorter when module is not in access.menuSorter', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {
					Opportunity: 0,
					Contact: 5,
				},
			};

			const result = getMenuSorterFromAccess(access, 'Campaign', 13);
			expect(result).toBe(13);
		});

		it('should return overridden menuSorter when module is in access.menuSorter', () => {
			const access = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access' as const,
				fields: {},
				fieldDefaults: {},
				menuSorter: {
					Campaign: 0,
					Opportunity: 5,
					Contact: 10,
				},
			} satisfies MetaAccess;

			const result = getMenuSorterFromAccess(access, 'Campaign', 13);
			expect(result).toBe(0);
		});

		it('should return overridden menuSorter for different module', () => {
			const access: MetaAccess = {
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

			const result = getMenuSorterFromAccess(access, 'Opportunity', 20);
			expect(result).toBe(5);
		});

		it('should handle empty menuSorter object', () => {
			const access: MetaAccess = {
				_id: 'Test:access:Default',
				document: 'Test',
				name: 'Default',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				menuSorter: {},
			};

			const result = getMenuSorterFromAccess(access, 'Campaign', 13);
			expect(result).toBe(13);
		});
	});
});
