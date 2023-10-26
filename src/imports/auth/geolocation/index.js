import { UAParser } from 'ua-parser-js';

import { getUser } from '@imports/auth/getUser';
import { MetaObject } from '@imports/model/MetaObject';

export async function saveGeoLocation({ authTokenId, longitude, latitude, userAgent, ip }) {
	try {
		if (longitude == null || latitude == null) {
			return { success: false, errors: [{ message: 'Longitude or Latitude not defined' }] };
		}

		const user = getUser(authTokenId);

		const ua = new UAParser(userAgent ?? 'API Call').getResult();

		const accessLog = {
			_createdAt: new Date(),
			_updatedAt: new Date(),
			ip,
			login: user.username,
			geolocation: [longitude, latitude],
			browser: ua.browser.name,
			browserVersion: ua.browser.version,
			os: ua.os.name,
			platform: ua.device.type,
			_user: [
				{
					_id: user._id,
					name: user.name,
					group: user.group,
				},
			],
		};

		await MetaObject.Collections.AccessLog.insertOne(accessLog);

		return {
			success: true,
		};
	} catch (error) {
		if (/^\[get-user\]/.test(error.message)) {
			return { success: false, errors: [{ message: 'User not found' }] };
		}
		return { success: false, errors: [{ message: error.message }] };
	}
}
