/* eslint import/prefer-default-export: 0 */
import 'isomorphic-fetch';
import Cookies from 'js-cookie';

import logger from 'utils/logger';

export async function getJson(path, allowCache = false) {
	const options = {
		headers: {
			Authorization: `Bearer ${Cookies.get('token')}`,
		},
	};
	try {
		const url = new URL(
			/^http/.test(path) ? path : `${window.location.protocol}//${window.location.hostname}${window.location.port == null ? '' : `:${window.location.port}`}${path}`,
		);
		if (allowCache === false) {
			url.searchParams.append('_dc', new Date().getTime());
		}
		const res = await fetch(url, options);
		return await res.json();
	} catch (error) {
		logger.error(error, `Error fetching data from ${path}`);
		return null;
	}
}
