import { proxy } from 'valtio';
import { devtools } from 'valtio/utils';
import Cookies from 'js-cookie';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';

import logger from 'utils/logger';
import fetchUserInfo from 'ui/DAL/fetchUserInfo';
import fetchMenu from 'ui/DAL/fetchMenu';
import fetchUserPreferences from 'ui/DAL/fetchUserPreferences';
import getLabel from 'utils/getLabel';

const FIELD_LIST = ['_id', 'name', 'group', 'icon', 'plurals', 'label', 'menuSorter'];

const userStore = proxy({
	async loadMenu() {
		return fetchMenu()
			.then(meta => (userStore.metaObjects = Object.keys(meta).reduce((acc, key) => ({ ...acc, [key.split(':').slice(1).join(':')]: meta[key] }), {})))
			.then(() =>
				fetchUserPreferences().then(({ success, data = [] } = {}) => {
					if (success === true) {
						userStore.preferences = data;
						data
							.filter(({ type, target }) => ['list', 'pivot'].includes(type) && target === 'Display')
							.forEach(({ code, document, type, name, value, view }) => {
								const [, , originName] = code.split(':');
								const originId = `${document}:${type}:${originName}`;

								const { label, plurals, ...origin } = userStore.metaObjects[originId] ?? {};

								const listMeta = {
									...origin,
									_id: code,
									plurals: Object.keys(plurals).reduce((a, l) => ({ ...a, [l]: `${plurals[l]} (${name})` }), {}),
									label: Object.keys(label).reduce((a, l) => ({ ...a, [l]: `${label[l]} (${name})` }), {}),
									view,
									...JSON.parse(value),
								};
								userStore.metaObjects[code] = listMeta;
							});
					}
				}),
			)
			.then(() => {
				const metaArr = Object.values(userStore.metaObjects);
				let menuFixIndex = 9999;
				const processItem = item => ({
					...pick(item, FIELD_LIST),
					// eslint-disable-next-line no-plusplus
					menuSorter: item.menuSorter ?? menuFixIndex++,
					// eslint-disable-next-line max-len
					lists: sortBy(
						metaArr
							.filter(({ document, type, menuSorter }) => document === item.name && type === 'list' && menuSorter !== -1)
							// eslint-disable-next-line no-plusplus
							.map(e => ({ ...e, sortLabel: getLabel(e.plurals ?? e.label ?? {}) }))
							.map(list => pick(list, FIELD_LIST)),
						['menuSorter', 'sortLabel'],
					),
					pivots: sortBy(
						metaArr
							.filter(({ document, type }) => document === item.name && type === 'pivot')
							.map(list => pick(list, FIELD_LIST))
							// eslint-disable-next-line no-plusplus
							.map(e => ({ ...e, sortLabel: getLabel(e.plurals ?? e.label ?? {}) })),
						['menuSorter', 'sortLabel'],
					),
					related: metaArr
						.filter(({ group }) => group === item.name)
						.map(processItem)
						.sort(({ menuSorter: a }, { menuSorter: b }) => a - b),
				});
				userStore.mainMenu = metaArr
					.filter(({ type, group, menuSorter }) => group == null && type === 'document' && menuSorter > 0)
					.map(processItem)
					.sort(({ menuSorter: a }, { menuSorter: b }) => a - b);
				return true;
			});
	},
	isLogged: new Promise(resolve => {
		const token = Cookies.get('token');
		if (token == null) {
			return resolve(false);
		}
		return fetchUserInfo()
			.then(({ logged, user }) => {
				userStore.user = user;
				if (logged === true) {
					return userStore.loadMenu().then(() => resolve(logged));
				}
				return resolve(logged);
			})
			.catch(err => {
				logger.error(err, 'Error getting user info');
				return resolve(false);
			});
	}).then(),
});

export const toggleMenuOpen = ({ id, group }) => {
	if (group != null) {
		return (userStore.mainMenu = userStore.mainMenu.map(item =>
			// eslint-disable-next-line no-underscore-dangle
			item.name === group ? { ...item, related: (item.related ?? []).map(r => (r._id === id ? { ...r, isOpen: !r.isOpen } : r)) } : item,
		));
	}
	// eslint-disable-next-line no-underscore-dangle
	return (userStore.mainMenu = userStore.mainMenu.map(item => (item._id === id ? { ...item, isOpen: !item.isOpen } : item)));
};

export const setLogin = async ({ user, token, cookieMaxAge }) => {
	Cookies.set('token', token, { path: '/', expires: Math.ceil((cookieMaxAge ?? 864e5) / 864e5) });
	userStore.user = user;
	await userStore.loadMenu();
	userStore.isLogged = true;
};

devtools(userStore, 'User Store');

export default userStore;
