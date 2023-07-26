import { IncomingMessage } from 'http';

import crypto from 'crypto';

import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { Collections } from '/imports/model/MetaObject';
import { User } from '/imports/model/User';
import { KonectyResult } from '/imports/types/result';

export const getUserFromRequest = async (request: IncomingMessage): Promise<User> => {
	const authTokenId = getAuthTokenIdFromReq(request);
	return getUser(authTokenId);
};

export const getHashedToken = (authTokenId: string) => {
	if (authTokenId.length === 43) {
		return crypto.createHash('sha256').update(authTokenId).digest('base64');
	}
	if (authTokenId.length === 24) {
		return authTokenId.toLowerCase();
	}
	return authTokenId;
};

export const getUser = async (authTokenId: string | null | undefined): Promise<User> => {
	if (authTokenId == null) {
		throw new Error('[get-user] No authTokenId found');
	}

	const hashedToken = getHashedToken(authTokenId);

	const user = await Collections['User'].findOne<User>({ 'services.resume.loginTokens.hashedToken': hashedToken });

	// If no user was found return error
	if (user == null) {
		throw new Error('[get-user] User not found');
	}

	if (user.active !== true) {
		throw new Error('[get-user] User inactive');
	}

	return user;
};

export async function getUserSafe(authTokenId: string | null | undefined): Promise<KonectyResult<User>> {
	try {
		const user = await getUser(authTokenId);
		return {
			success: true,
			data: user,
		};
	} catch (error) {
		return {
			success: false,
			errors: [
				{
					message: (error as Error).message,
				},
			],
		};
	}
}
