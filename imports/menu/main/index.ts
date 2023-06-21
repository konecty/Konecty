import set from 'lodash/set';
import get from 'lodash/get';
import concat from 'lodash/concat';
import sortBy from 'lodash/sortBy';

import { MetaObjectCollection } from '/imports/model/MetaObject';
import { User } from '/imports/model/User';
import { getAccessFor } from '/imports/utils/accessUtils';
import { MenuItem, MenuGroup, MenuItemSchema } from '/imports/model/Menu';
import { logger } from '/imports/utils/logger';

export async function mainMenu(user: User) {
	const menuItens = await MetaObjectCollection.find({ type: { $in: ['document', 'group', 'list', 'pivot'] }, menuSorter: { $nin: [-1, -2, -3] } }).toArray();

	const mainMenu = menuItens.reduce((acc, item) => {
		const document = item.type === 'document' ? item.name : item.document;

		const accessAllowed = (type: string, name: string) => {
			if (type === 'group') {
				return true;
			}
			return getAccessFor(name, user) !== false;
		};

		if (accessAllowed(item.type, document) === false) {
			return acc;
		}
		const itemPath = [];
		const findGroup = (name: string) => menuItens.find(d => ['group', 'document'].includes(d.type) && d.name === name);

		if (item.group != null) {
			const group = findGroup(item.group);
			if (group == null || accessAllowed(group.type, item.group) === false) {
				return acc;
			}
			itemPath.push(item.group);
		}
		if (['group', 'document'].includes(item.type)) {
			itemPath.push(item.name);
		} else {
			if (accessAllowed(item.type, document) === false) {
				return acc;
			}
			const documentGroup = findGroup(document);
			if (documentGroup == null) {
				return acc;
			}
			if (item.group == null) {
				if (documentGroup?.group != null) {
					if (accessAllowed(documentGroup.type, documentGroup.group) === false) {
						return acc;
					}
					itemPath.push(documentGroup.group);
				}
			}

			itemPath.push(document, item.type, item.name);
		}

		const itemResult = MenuItemSchema.safeParse({
			name: item.name,
			type: item.type,
			document,
			menuSorter: item.menuSorter,
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
			set(acc, itemPath, itemResult.data as MenuItem);
		}
		return acc;
	}, {});

	function parseMenuGroups(obj: Record<string, unknown>): MenuGroup | null {
		const result = {};
		Object.entries(obj).forEach(([key, value]) => {
			if (['name', 'type', 'document', 'menuSorter', 'icon'].includes(key)) {
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
