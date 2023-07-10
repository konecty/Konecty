import set from 'lodash/set';
import merge from 'lodash/merge';
import get from 'lodash/get';
import concat from 'lodash/concat';
import sortBy from 'lodash/sortBy';

import { Collections, MetaObjectCollection } from '/imports/model/MetaObject';
import { User } from '/imports/model/User';
import { getAccessFor } from '/imports/utils/accessUtils';
import { MenuItem, MenuGroup, MenuItemSchema } from '/imports/model/Menu';
import { logger } from '/imports/utils/logger';
import { MetaObjectType } from '/imports/types/metadata';

export async function mainMenu(user: User) {
	const menuItens = await MetaObjectCollection.find<MetaObjectType>({ type: { $in: ['document', 'group', 'list', 'pivot'] }, menuSorter: { $nin: [-1, -2, -3] } }).toArray();

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

	const getformatedColumns = (
		columns: Record<
			string,
			{
				name: string;
				linkedField: string;
				visible: boolean;
				minWidth?: number | undefined;
				sort?: number | undefined;
			}
		>,
	) => {
		const columnsArray = Object.entries(columns).map(([, value]) => value);

		return sortBy(columnsArray, ['sort', 'name']);
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
				columns: getformatedColumns(item.columns),
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

	const preferenceItems = await Collections['Preference']
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
					columns: getformatedColumns(preferenceItem.columns),
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
