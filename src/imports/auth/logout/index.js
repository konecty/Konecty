import { getHashedToken, getUser } from '@imports/auth/getUser';
import { cleanupSessions } from '@imports/auth/login';
import { MetaObject } from '../../model/MetaObject';

export async function logout(authTokenId) {
	try {
		const user = await getUser(authTokenId);

		const updateObj = {
			$pull: {
				'services.resume.loginTokens': { hashedToken: getHashedToken(authTokenId) },
			},
		};

		await MetaObject.Collections.User.updateOne({ _id: user._id }, updateObj);

		await cleanupSessions(user._id);

		return { success: true };
	} catch (error) {
		if (/^\[get-user\]/.test(error.message)) {
			return { success: false, errors: [{ message: 'User not found' }] };
		}
		throw error;
	}
}
