/* eslint import/prefer-default-export: 0 */
import 'isomorphic-fetch';
import Cookies from 'js-cookie';

import logger from 'utils/logger';

export async function getJson(url) {
	const options = {
		headers: {
			Authorization: `Bearer ${Cookies.get('token')}`,
		},
	};
	try {
		const res = await fetch(url, options);
		return await res.json();
	} catch (error) {
		logger.error(error, `Error fetching data from ${url}`);
		return null;
	}
}
