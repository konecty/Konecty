import isString from 'lodash/isString';

import { getUserSafe } from '@imports/auth/getUser';
import { MetaObject } from '@imports/model/MetaObject';
import { errorReturn, successReturn } from '@imports/utils/return';
import { getAccessFor } from '../utils/accessUtils';
import { accentToRegex } from '../utils/strUtils';

// Constants
const MAX_SEARCH_RESULTS = 10;
const MIN_QUERY_LENGTH = 1;

// Types
type SearchUsersForMentionParams = {
	authTokenId?: string;
	document: string;
	dataId: string;
	query: string;
};

type SearchableUser = {
	_id: string;
	name?: string;
	username?: string;
	group?: {
		_id: string;
		name: string;
	};
};

/**
 * Search for users that can be mentioned in a comment
 * Only returns users who have access to the document
 */
export async function searchUsersForMention({ authTokenId, document, dataId, query }: SearchUsersForMentionParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const currentUser = getUserResponse.data;
	const access = getAccessFor(document, currentUser);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const documentCollection = MetaObject.Collections[document];
	if (documentCollection == null) {
		return errorReturn(`[${document}] Document collection not found`);
	}

	// Verify record exists
	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	const record = await documentCollection.findOne({ _id: dataId });
	if (record == null) {
		return errorReturn(`[${document}] Record not found using id ${dataId}`);
	}

	// Validate query
	if (!isString(query) || query.length < MIN_QUERY_LENGTH) {
		return successReturn([]);
	}

	const userCollection = MetaObject.Collections['User'];
	if (!userCollection) {
		return errorReturn('User collection not found');
	}

	// Build search pattern (accent-insensitive)
	const searchPattern = accentToRegex(query);
	const searchRegex = new RegExp(searchPattern, 'i');

	// Search users by name or username
	const users = await userCollection
		.find<SearchableUser>(
			{
				active: true,
				$or: [
					{ name: { $regex: searchRegex } },
					{ username: { $regex: searchRegex } },
				],
			},
			{
				projection: { _id: 1, name: 1, username: 1, group: 1, access: 1, admin: 1 },
				limit: MAX_SEARCH_RESULTS * 2, // Fetch more to filter by permissions
			},
		)
		.toArray();

	// Filter users by document access
	const accessibleUsers: SearchableUser[] = [];
	
	for (const user of users) {
		// Skip current user
		if (user._id === currentUser._id) continue;
		
		// Check if user has access to the document
		const userAccess = getAccessFor(document, user as any);
		if (userAccess !== false) {
			accessibleUsers.push({
				_id: user._id,
				name: user.name,
				username: user.username,
				group: user.group,
			});
			
			// Stop if we have enough results
			if (accessibleUsers.length >= MAX_SEARCH_RESULTS) break;
		}
	}

	return successReturn(accessibleUsers);
}
