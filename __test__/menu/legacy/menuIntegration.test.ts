// @ts-expect-error bun:test é reconhecido apenas pelo runner do Bun
import { describe, it, expect, beforeEach, vi } from 'bun:test';

import { menuFull } from '../../../src/imports/menu/legacy/index.js';
import { MetaObject } from '../../../src/imports/model/MetaObject';
import { getUserSafe } from '../../../src/imports/auth/getUser';

// Mock dependencies
vi.mock('../../../src/imports/model/MetaObject');
vi.mock('../../../src/imports/auth/getUser');

describe('Menu Integration Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('menuFull with filtering', () => {
		it('should filter lists when access has hideListsFromMenu property', async () => {
			// Mock user with access configuration
			const mockUser = {
				_id: 'user123',
				access: {
					defaults: 'Default',
					Test: 'Manager',
				},
			};

			// Mock access configuration with hideListsFromMenu
			const mockAccess = {
				_id: 'Test:access:Manager',
				document: 'Test',
				name: 'Manager',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hideListsFromMenu: ['HiddenList'],
			};

			// Mock namespace
			const mockNamespace = {
				_id: 'Namespace',
				ns: 'test',
			};

			// Mock meta objects including a list that should be filtered
			const mockMetaObjects = [
				{
					_id: 'Test:list:HiddenList',
					type: 'list',
					name: 'HiddenList',
					document: 'Test',
				},
				{
					_id: 'Test:list:VisibleList',
					type: 'list',
					name: 'VisibleList',
					document: 'Test',
				},
				{
					_id: 'Test:document:Test',
					type: 'document',
					name: 'Test',
					document: 'Test',
				},
			];

			// Setup mocks
			vi.mocked(getUserSafe).mockResolvedValue({
				success: true,
				data: mockUser,
				errors: null,
			});

			vi.mocked(MetaObject.MetaObject.findOne).mockResolvedValue(mockNamespace);
			vi.mocked(MetaObject.MetaObject.find).mockReturnValue({
				toArray: vi.fn().mockResolvedValue(mockMetaObjects),
			} as any);

			// Mock getAccessFor to return our mock access
			vi.doMock('../../../src/imports/utils/accessUtils', () => ({
				getAccessFor: vi.fn().mockReturnValue(mockAccess),
			}));

			const result = await menuFull({ authTokenId: 'test-token' });

			// Verify that the hidden list is not in the result
			expect(result).not.toHaveProperty('test:Test:list:HiddenList');
			// Verify that the visible list is in the result
			expect(result).toHaveProperty('test:Test:list:VisibleList');
			// Verify that the document is in the result
			expect(result).toHaveProperty('test:Test:document:Test');
		});

		it('should filter pivots when access has hidePivotsFromMenu property', async () => {
			// Mock user with access configuration
			const mockUser = {
				_id: 'user123',
				access: {
					defaults: 'Default',
					Test: 'Manager',
				},
			};

			// Mock access configuration with hidePivotsFromMenu
			const mockAccess = {
				_id: 'Test:access:Manager',
				document: 'Test',
				name: 'Manager',
				type: 'access',
				fields: {},
				fieldDefaults: {},
				hidePivotsFromMenu: ['HiddenPivot'],
			};

			// Mock namespace
			const mockNamespace = {
				_id: 'Namespace',
				ns: 'test',
			};

			// Mock meta objects including a pivot that should be filtered
			const mockMetaObjects = [
				{
					_id: 'Test:pivot:HiddenPivot',
					type: 'pivot',
					name: 'HiddenPivot',
					document: 'Test',
				},
				{
					_id: 'Test:pivot:VisiblePivot',
					type: 'pivot',
					name: 'VisiblePivot',
					document: 'Test',
				},
				{
					_id: 'Test:document:Test',
					type: 'document',
					name: 'Test',
					document: 'Test',
				},
			];

			// Setup mocks
			vi.mocked(getUserSafe).mockResolvedValue({
				success: true,
				data: mockUser,
				errors: null,
			});

			vi.mocked(MetaObject.MetaObject.findOne).mockResolvedValue(mockNamespace);
			vi.mocked(MetaObject.MetaObject.find).mockReturnValue({
				toArray: vi.fn().mockResolvedValue(mockMetaObjects),
			} as any);

			// Mock getAccessFor to return our mock access
			vi.doMock('../../../src/imports/utils/accessUtils', () => ({
				getAccessFor: vi.fn().mockReturnValue(mockAccess),
			}));

			const result = await menuFull({ authTokenId: 'test-token' });

			// Verify that the hidden pivot is not in the result
			expect(result).not.toHaveProperty('test:Test:pivot:HiddenPivot');
			// Verify that the visible pivot is in the result
			expect(result).toHaveProperty('test:Test:pivot:VisiblePivot');
			// Verify that the document is in the result
			expect(result).toHaveProperty('test:Test:document:Test');
		});

		it('should not filter when access has no hide properties', async () => {
			// Mock user with access configuration
			const mockUser = {
				_id: 'user123',
				access: {
					defaults: 'Default',
					Test: 'Manager',
				},
			};

			// Mock access configuration without hide properties
			const mockAccess = {
				_id: 'Test:access:Manager',
				document: 'Test',
				name: 'Manager',
				type: 'access',
				fields: {},
				fieldDefaults: {},
			};

			// Mock namespace
			const mockNamespace = {
				_id: 'Namespace',
				ns: 'test',
			};

			// Mock meta objects
			const mockMetaObjects = [
				{
					_id: 'Test:list:MyList',
					type: 'list',
					name: 'MyList',
					document: 'Test',
				},
				{
					_id: 'Test:pivot:MyPivot',
					type: 'pivot',
					name: 'MyPivot',
					document: 'Test',
				},
			];

			// Setup mocks
			vi.mocked(getUserSafe).mockResolvedValue({
				success: true,
				data: mockUser,
				errors: null,
			});

			vi.mocked(MetaObject.MetaObject.findOne).mockResolvedValue(mockNamespace);
			vi.mocked(MetaObject.MetaObject.find).mockReturnValue({
				toArray: vi.fn().mockResolvedValue(mockMetaObjects),
			} as any);

			// Mock getAccessFor to return our mock access
			vi.doMock('../../../src/imports/utils/accessUtils', () => ({
				getAccessFor: vi.fn().mockReturnValue(mockAccess),
			}));

			const result = await menuFull({ authTokenId: 'test-token' });

			// Verify that all objects are in the result when no filtering is applied
			expect(result).toHaveProperty('test:Test:list:MyList');
			expect(result).toHaveProperty('test:Test:pivot:MyPivot');
		});
	});
}); 