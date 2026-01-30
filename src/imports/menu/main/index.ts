import concat from 'lodash/concat';
import get from 'lodash/get';
import merge from 'lodash/merge';
import set from 'lodash/set';
import sortBy from 'lodash/sortBy';

import { MenuGroup, MenuItem, MenuItemSchema } from '../../model/Menu';
import { MetaObject } from '../../model/MetaObject';
import { User } from '../../model/User';
import { MetaObjectType } from '../../types/metadata';
import { getAccessFor } from '../../utils/accessUtils';
import { logger } from '../../utils/logger';

const MenuTypes = ['document', 'group', 'list', 'pivot'] as const;
type MenuItemsMeta = Extract<MetaObjectType, { type: (typeof MenuTypes)[number] }>;

/** menuSorter values: -1 hidden, -2 admin menu, -3 user menu */
const MENU_SORTER_ADMIN = -2;
const MENU_SORTER_USER = -3;
const MENU_SORTER_EXCLUDE_MAIN = [-1, MENU_SORTER_ADMIN, MENU_SORTER_USER];

export async function mainMenu(user: User) {
	const menuItens = await MetaObject.MetaObject.find<MenuItemsMeta>({
		type: { $in: MenuTypes },
		menuSorter: { $nin: MENU_SORTER_EXCLUDE_MAIN },
	}).toArray();

	const accessAllowed = (type: string, name: string) => {
		if (type === 'group') {
			return true;
		}
		return getAccessFor(name, user) !== false;
	};

	const findGroup = (name: string) => menuItens.find(d => ['group', 'document'].includes(d.type) && d.name === name);

	const getDocumentName = ({ type, name, document }: { type: string; name?: string; document?: string }) => {
		if (type === 'document') {
			return name;
		}
		if (type === 'list' || type === 'pivot') {
			return document;
		}
		return null;
	};

	const getItemPath = ({ type, name, group: itemGroup, document: itemDocument }: { type: string; name: string; group?: string; document?: string }) => {
		const document = getDocumentName({ type, name, document: itemDocument });

		if (document == null) {
			return null;
		}

		const itemPath: Array<string> = [];
		if (type === 'document' || type === 'list' || type === 'pivot') {
			if (itemGroup != null) {
				const group = findGroup(itemGroup);
				if (group == null || accessAllowed(group.type, itemGroup) === false) {
					return null;
				}
				itemPath.push(itemGroup);
			}
		}
		if (['group', 'document'].includes(type)) {
			itemPath.push(name);
		} else if (type === 'list' || type === 'pivot') {
			if (accessAllowed(type, document) === false) {
				return null;
			}
			const documentGroup = findGroup(document);
			if (documentGroup == null) {
				return null;
			}
			if (itemGroup == null) {
				if (documentGroup.type === 'document' && documentGroup?.group != null) {
					if (accessAllowed(documentGroup.type, documentGroup.group) === false) {
						return null;
					}
					itemPath.push(documentGroup.group);
				}
			}

			itemPath.push(document, type, name);
		}
		return itemPath;
	};

	const mainMenu = menuItens.reduce((acc, item, index) => {
		const document = getDocumentName(item);

		if (document == null) {
			return acc;
		}

		if (accessAllowed(item.type, document) === false) {
			return acc;
		}
		const itemPath = getItemPath(item);

		if (itemPath == null) {
			return acc;
		}

		if (item.type === 'list') {
			const itemResult = MenuItemSchema.safeParse({
				_id: item._id,
				name: item.name,
				type: item.type,
				document,
				menuSorter: item.menuSorter ?? 999 + index,
				icon: item.icon,
			});

			if (itemResult.success === false) {
				logger.error(
					{
						item,
						error: itemResult.error,
					},
					'Error parsing menu item',
				);
			} else {
				merge(acc, set({}, itemPath, itemResult.data as MenuItem));
			}
		} else if (item.type === 'document' || item.type === 'group' || item.type === 'pivot') {
			const itemResult = MenuItemSchema.safeParse({
				_id: item._id,
				name: item.name,
				type: item.type,
				document,
				menuSorter: item.menuSorter ?? 999 + index,
				icon: item.icon,
			});

			if (itemResult.success === false) {
				logger.error(
					{
						item,
						error: itemResult.error,
					},
					'Error parsing menu item',
				);
			} else {
				merge(acc, set({}, itemPath, itemResult.data as MenuItem));
			}
		}
		return acc;
	}, {});

	const preferenceItems = await MetaObject.Collections['Preference']
		.find<{
			_id: string;
			code: string;
			type: string;
			name: string;
			document: string;
			target: string;
			view?: string;
			value: string;
		}>({ '_user._id': user._id, type: { $in: ['list', 'pivot'] }, target: 'Display' })
		.toArray();

	preferenceItems.forEach((item, index) => {
		const document = getDocumentName({ type: item.type, name: item.name, document: item.document });

		if (document == null) {
			return;
		}

		if (accessAllowed('document', document) === false) {
			return;
		}

		const [, , originalItemName] = item.code.split(':');

		const originalItem = menuItens.find(i => get(i, 'document') === document && i.type === item.type && i.name === originalItemName);

		if (originalItem == null) {
			return;
		}

		const preferenceItem = Object.assign({}, originalItem, JSON.parse(item.value));
		set(preferenceItem, 'menuSorter', index + 9999);

		const itemPath = getItemPath({ type: preferenceItem.type, name: preferenceItem.name, group: preferenceItem.group, document });

		if (itemPath == null) {
			return;
		}

		merge(
			mainMenu,
			set(
				{},
				itemPath,
				MenuItemSchema.parse({
					...preferenceItem,
					_id: item._id,
					name: originalItemName,
					isPreference: true,
					preferenceName: preferenceItem.name,
				}),
			),
		);
	});

	function parseMenuGroups(obj: Record<string, unknown>): MenuGroup | null {
		const result = {};
		Object.entries(obj).forEach(([key, value]) => {
			try {
				if (['_id', 'name', 'type', 'document', 'menuSorter', 'icon', 'isPreference', 'preferenceName'].includes(key)) {
					set(result, key, get(obj, key));
				} else if (key === 'list') {
					const lists = Object.values(value as Record<string, MenuItem>).map(list => {
						return list;
					});
					if (lists.length > 0) {
						set(result, 'lists', sortBy(lists, ['menuSorter', 'name']));
					}
				} else if (key === 'pivot') {
					const pivots = Object.values(value as Record<string, MenuItem>).map(pivot => {
						return pivot;
					});
					if (pivots.length > 0) {
						set(result, 'pivots', sortBy(pivots, ['menuSorter', 'name']));
					}
				} else {
					const children = parseMenuGroups(value as Record<string, unknown>);
					if (children != null) {
						if (get(result, 'children') == null) {
							set(result, 'children', []);
						}
						set(result, 'children', concat(get(result, 'children'), children));
					}
				}
			} catch (error) {
				logger.error({ error, key, value }, 'Error parsing menu group');
			}
		});

		if (((result as MenuGroup).lists?.length ?? 0) > 0 || ((result as MenuGroup).pivots?.length ?? 0) > 0 || ((result as MenuGroup).children?.length ?? 0) > 0) {
			return result as MenuGroup;
		}
		return null;
	}

	return sortBy(
		Object.values(mainMenu)
			.map(menu => parseMenuGroups(menu as Record<string, unknown>))
			.filter(menu => menu != null),
		['menuSorter', 'name'],
	);
}

/**
 * Builds menu for documents with a given menuSorter (user -3 or admin -2).
 * Used by /api/menu/user and /api/menu/admin.
 */
export async function menuByDocumentSorter(user: User, targetSorter: number): Promise<MenuGroup[]> {
	const documents = await MetaObject.MetaObject.find<MenuItemsMeta>({
		type: 'document',
		menuSorter: targetSorter,
	}).toArray();

	const documentNames = documents.map(d => d.name);
	if (documentNames.length === 0) {
		return [];
	}

	const groups = await MetaObject.MetaObject.find<MenuItemsMeta>({
		type: 'group',
		name: { $in: [...new Set(documents.map(d => d.group).filter(Boolean))] },
	}).toArray();

	const listsAndPivots = await MetaObject.MetaObject.find<MenuItemsMeta>({
		type: { $in: ['list', 'pivot'] },
		document: { $in: documentNames },
	}).toArray();

	const menuItens = sortBy(
		[...documents, ...groups, ...listsAndPivots],
		['menuSorter', 'name'],
	) as MenuItemsMeta[];

	const accessAllowed = (type: string, name: string) => {
		if (type === 'group') return true;
		return getAccessFor(name, user) !== false;
	};

	const findGroup = (name: string) => menuItens.find(d => ['group', 'document'].includes(d.type) && d.name === name);

	const getDocumentName = ({ type, name, document }: { type: string; name?: string; document?: string }) => {
		if (type === 'document') return name;
		if (type === 'list' || type === 'pivot') return document;
		return null;
	};

	const getItemPath = ({
		type,
		name,
		group: itemGroup,
		document: itemDocument,
	}: {
		type: string;
		name: string;
		group?: string;
		document?: string;
	}) => {
		const document = getDocumentName({ type, name, document: itemDocument });
		if (document == null) return null;
		const itemPath: Array<string> = [];
		if (type === 'document' || type === 'list' || type === 'pivot') {
			if (itemGroup != null) {
				const group = findGroup(itemGroup);
				if (group == null || accessAllowed(group.type, itemGroup) === false) return null;
				itemPath.push(itemGroup);
			}
		}
		if (['group', 'document'].includes(type)) {
			itemPath.push(name);
		} else if (type === 'list' || type === 'pivot') {
			if (accessAllowed(type, document) === false) return null;
			const documentGroup = findGroup(document);
			if (documentGroup == null) return null;
			if (itemGroup == null && documentGroup.type === 'document' && documentGroup?.group != null) {
				if (accessAllowed(documentGroup.type, documentGroup.group) === false) return null;
				itemPath.push(documentGroup.group);
			}
			itemPath.push(document, type, name);
		}
		return itemPath;
	};

	const built = menuItens.reduce((acc, item, index) => {
		const document = getDocumentName(item);
		if (document == null || accessAllowed(item.type, document) === false) return acc;
		const itemPath = getItemPath(item);
		if (itemPath == null) return acc;
		const itemResult = MenuItemSchema.safeParse({
			_id: item._id,
			name: item.name,
			type: item.type,
			document,
			menuSorter: item.menuSorter ?? 999 + index,
			icon: item.icon,
		});
		if (!itemResult.success) return acc;
		merge(acc, set({}, itemPath, itemResult.data as MenuItem));
		return acc;
	}, {});

	function parseMenuGroups(obj: Record<string, unknown>): MenuGroup | null {
		const result: Record<string, unknown> = {};
		Object.entries(obj).forEach(([key, value]) => {
			try {
				if (['_id', 'name', 'type', 'document', 'menuSorter', 'icon', 'isPreference', 'preferenceName'].includes(key)) {
					set(result, key, get(obj, key));
				} else if (key === 'list') {
					const lists = Object.values(value as Record<string, MenuItem>);
					if (lists.length > 0) set(result, 'lists', sortBy(lists, ['menuSorter', 'name']));
				} else if (key === 'pivot') {
					const pivots = Object.values(value as Record<string, MenuItem>);
					if (pivots.length > 0) set(result, 'pivots', sortBy(pivots, ['menuSorter', 'name']));
				} else {
					const children = parseMenuGroups(value as Record<string, unknown>);
					if (children != null) {
						set(result, 'children', concat((get(result, 'children') as MenuGroup[]) ?? [], children));
					}
				}
			} catch (error) {
				logger.error({ error, key, value }, 'Error parsing menu group');
			}
		});
		if (((result as MenuGroup).lists?.length ?? 0) > 0 || ((result as MenuGroup).pivots?.length ?? 0) > 0 || ((result as MenuGroup).children?.length ?? 0) > 0) {
			return result as MenuGroup;
		}
		return null;
	}

	return sortBy(
		Object.values(built)
			.map(menu => parseMenuGroups(menu as Record<string, unknown>))
			.filter((menu): menu is MenuGroup => menu != null),
		['menuSorter', 'name'],
	);
}

export async function userMenu(user: User): Promise<MenuGroup[]> {
	return menuByDocumentSorter(user, MENU_SORTER_USER);
}

export async function adminMenu(user: User): Promise<MenuGroup[]> {
	return menuByDocumentSorter(user, MENU_SORTER_ADMIN);
}
