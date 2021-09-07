/* eslint import/prefer-default-export: 0 */
import 'isomorphic-fetch';
import Cookies from 'js-cookie';
import merge from 'lodash/merge';

import logger from 'utils/logger';

const getUrl = (path, allowCache = false) => {
	const url = new URL(
		/^http/.test(path) ? path : `${window.location.protocol}//${window.location.hostname}${window.location.port == null ? '' : `:${window.location.port}`}${path}`,
	);
	if (allowCache === false) {
		url.searchParams.append('_dc', new Date().getTime());
	}

	return url;
};

export async function getJson(path, allowCache = false) {
	const options = {
		headers: {
			Authorization: `Bearer ${Cookies.get('token')}`,
		},
	};
	try {
		const res = await fetch(getUrl(path, allowCache), options);
		return await res.json();
	} catch (error) {
		logger.error(error, `Error fetching data from ${path}`);
		return null;
	}
}

export async function postJson(path, data, options = {}) {
	try {
		const token = Cookies.get('token');
		const res = await fetch(
			getUrl(path, false),
			merge(
				{
					method: 'POST',
					mode: 'cors',
					cache: 'no-cache',
					credentials: 'same-origin',
					redirect: 'follow',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data),
				},
				token != null ? { headers: { Authorization: `Bearer ${token}` } } : {},
				options,
			),
		);
		if (/^2[0-9]{2}$/.test(res.status)) {
			return res.json();
		}

		if (/^4[0-9]{2}$/.test(res.status)) {
			const resultData = await res.json();
			return {
				success: false,
				...resultData,
			};
		}

		logger.error({ path, data, errorCode: res.status, error: res.statusText }, `Server error sendind data to ${path}`);
		return null;
	} catch (error) {
		logger.error({ path, data, error }, `Error sendind data to ${path}`);
		return null;
	}
}
