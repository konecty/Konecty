import isString from 'lodash/isString';
import pick from 'lodash/pick';

import { getUserSafe } from '@imports/auth/getUser';
import eventManager from '@imports/lib/EventManager';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { errorReturn, successReturn } from '@imports/utils/return';
import { getAccessFor } from '../utils/accessUtils';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';
import { createNotificationsForComment } from './notifications';
import { listSubscribers } from './subscriptions';

/** Reference type for MongoDB populated/embedded docs that have _id */
type WithIdRef = { _id?: string };

// Constants
const MAX_COMMENT_LENGTH = 5000;
const MENTION_REGEX = /@([\w.-]+)/g;

// Types
type FindCommentsParams = {
	authTokenId?: string;
	document: string;
	dataId: string;
};

type SearchCommentsParams = FindCommentsParams & {
	query?: string;
	authorId?: string;
	startDate?: string;
	endDate?: string;
	page?: number;
	limit?: number;
};

type UpdateCommentParams = FindCommentsParams & {
	commentId: string;
	text: string;
};

type DeleteCommentParams = FindCommentsParams & {
	commentId: string;
};

type MentionedUser = {
	_id: string;
	name?: string;
	username?: string;
};

// Utility functions

/**
 * Sanitize text to prevent XSS attacks
 * Escapes HTML special characters
 */
const sanitizeText = (text: string): string => {
	const htmlEntities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
	};
	return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
};

/**
 * Validate comment text
 */
const validateCommentText = (text: unknown, document: string): { valid: boolean; error?: string } => {
	if (isString(text) === false || text.length === 0) {
		return { valid: false, error: `[${document}] Comment must be a string with one or more characters` };
	}
	if (text.length > MAX_COMMENT_LENGTH) {
		return { valid: false, error: `[${document}] Comment must not exceed ${MAX_COMMENT_LENGTH} characters` };
	}
	return { valid: true };
};

/**
 * Extract @mentions from comment text
 * Returns array of usernames (without the @ symbol)
 */
export const extractMentions = (text: string): string[] => {
	if (!isString(text)) return [];
	
	const matches = text.match(MENTION_REGEX);
	if (!matches) return [];
	
	// Remove @ prefix and deduplicate
	const usernames = matches.map(match => match.substring(1));
	return [...new Set(usernames)];
};

/**
 * Resolve usernames to user IDs
 * Returns array of user objects with _id, name, and username
 */
export const resolveMentions = async (usernames: string[]): Promise<MentionedUser[]> => {
	if (usernames.length === 0) return [];
	
	const userCollection = MetaObject.Collections['User'];
	if (!userCollection) return [];
	
	const users = await userCollection
		.find(
			{
				$or: [
					{ username: { $in: usernames } },
					{ name: { $in: usernames } },
				],
				active: true,
			},
			{
				projection: { _id: 1, name: 1, username: 1 },
			},
		)
		.toArray();
	
	return users.map(user => ({
		_id: user._id,
		name: user.name as string | undefined,
		username: user.username as string | undefined,
	}));
};

/**
 * Validate that mentioned users have permission to access the document/record
 * Returns only the userIds that have valid access
 */
export const validateMentions = async (
	mentionedUsers: MentionedUser[],
	document: string,
	dataId: string,
): Promise<string[]> => {
	if (mentionedUsers.length === 0) return [];
	
	const validUserIds: string[] = [];
	
	for (const mentionedUser of mentionedUsers) {
		// Load the full user to check access
		const userCollection = MetaObject.Collections['User'];
		const user = await userCollection?.findOne({ _id: mentionedUser._id, active: true });
		
		if (!user) continue;
		
		// Check if user has access to the document
		const access = getAccessFor(document, user as User);
		if (access !== false) {
			validUserIds.push(mentionedUser._id);
		}
	}
	
	return validUserIds;
};

export async function findComments({ authTokenId, document, dataId }: FindCommentsParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user as User);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];

	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	const data = await commentCollection.find({ dataId }, { sort: { _createdAt: 1 } }).toArray();
	return successReturn(data);
}

// Constants for search
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function searchComments({ 
	authTokenId, 
	document, 
	dataId, 
	query,
	authorId,
	startDate,
	endDate,
	page = 1,
	limit = DEFAULT_PAGE_SIZE,
}: SearchCommentsParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user as User);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];

	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	// Build query
	const mongoQuery: Record<string, any> = { 
		dataId,
		deletedAt: { $exists: false }, // Exclude deleted comments
	};

	// Text search (case-insensitive)
	if (query && isString(query) && query.trim().length > 0) {
		mongoQuery.text = { $regex: query.trim(), $options: 'i' };
	}

	// Author filter
	if (authorId && isString(authorId)) {
		mongoQuery['_createdBy._id'] = authorId;
	}

	// Date range filter
	if (startDate || endDate) {
		mongoQuery._createdAt = {};
		if (startDate) {
			try {
				mongoQuery._createdAt.$gte = new Date(startDate);
			} catch (e) {
				// Invalid date, skip
			}
		}
		if (endDate) {
			try {
				mongoQuery._createdAt.$lte = new Date(endDate);
			} catch (e) {
				// Invalid date, skip
			}
		}
		// Remove empty date filter
		if (Object.keys(mongoQuery._createdAt).length === 0) {
			delete mongoQuery._createdAt;
		}
	}

	// Pagination
	const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
	const safePage = Math.max(1, page);
	const skip = (safePage - 1) * safeLimit;

	try {
		const [data, total] = await Promise.all([
			commentCollection
				.find(mongoQuery)
				.sort({ _createdAt: -1 }) // Newest first for search results
				.skip(skip)
				.limit(safeLimit)
				.toArray(),
			commentCollection.countDocuments(mongoQuery),
		]);

		return successReturn({
			data,
			total,
			page: safePage,
			pages: Math.ceil(total / safeLimit),
			limit: safeLimit,
		});
	} catch (e) {
		const error = e as Error;
		logger.error(e, `Comment - Search Error ${error.message}`);
		return errorReturn(`[${document}] Error searching comments - ${error.message}`);
	}
}

type CreateCommentParams = FindCommentsParams & { text: string; parentId?: string };

export async function createComment({ authTokenId, document, dataId, text, parentId }: CreateCommentParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user as User);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];
	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	const documentCollection = MetaObject.Collections[document];
	if (documentCollection == null) {
		return errorReturn(`[${document}] Document collection not found`);
	}

	// Validate text
	const textValidation = validateCommentText(text, document);
	if (textValidation.valid === false) {
		return errorReturn(textValidation.error as string);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	const record = await documentCollection.findOne({ _id: dataId });
	if (record == null) {
		return errorReturn(`[${document}] Record not found using id ${dataId}`);
	}

	// Validate parentId if provided (for threading)
	if (parentId != null) {
		if (isString(parentId) === false) {
			return errorReturn(`[${document}] Param parentId must be a valid string id`);
		}
		const parentComment = await commentCollection.findOne({ _id: parentId, dataId });
		if (parentComment == null) {
			return errorReturn(`[${document}] Parent comment not found`);
		}
	}

	const sanitizedText = sanitizeText(text);

	// Extract and validate mentions
	const mentionUsernames = extractMentions(text);
	const mentionedUsers = await resolveMentions(mentionUsernames);
	const validMentionIds = await validateMentions(mentionedUsers, document, dataId);

	const data = {
		_id: randomId(),
		dataId,
		_createdAt: new Date(),
		_createdBy: pick(user, ['_id', 'group', 'name']),
		text: sanitizedText,
		...(parentId != null && { parentId }),
		...(validMentionIds.length > 0 && { mentions: validMentionIds }),
	};

	try {
		await commentCollection.insertOne(data);
		await eventManager.sendEvent(document, 'comment', {
			data: {
				...pick(data, ['_id', 'text', 'mentions']),
				mentions: validMentionIds,
				mentionedUsers: mentionedUsers.filter(u => validMentionIds.includes(u._id)),
			},
			full: data,
		});

		// Get parent comment author for reply notifications
		let parentCommentAuthorId: string | undefined;
		if (parentId) {
			const parentComment = await commentCollection.findOne({ _id: parentId });
			parentCommentAuthorId = (parentComment?._createdBy as WithIdRef | undefined)?._id;
		}

		// Get record owner for notifications
		const recordOwnerId = (record._user as WithIdRef | undefined)?._id;

		// Get subscribers for this record
		const subscribers = await listSubscribers({ module: document, dataId });

		// Create notifications for mentioned users, owner, and subscribers
		await createNotificationsForComment(
			{
				_id: data._id,
				dataId: data.dataId,
				text: data.text,
				mentions: validMentionIds,
				parentId: data.parentId,
				_createdBy: data._createdBy,
			},
			{
				document,
				recordOwnerId,
				parentCommentAuthorId,
				subscribers,
			},
			user,
		);

		return successReturn([data]);
	} catch (e) {
		const error = e as Error;
		logger.error(e, `Comment - Insert Error ${error.message}`);

		return errorReturn(`[${document}] Error inserting comment - ${error.message}`);
	}
}

export async function updateComment({ authTokenId, document, dataId, commentId, text }: UpdateCommentParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user as User);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];
	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	// Validate text
	const textValidation = validateCommentText(text, document);
	if (textValidation.valid === false) {
		return errorReturn(textValidation.error as string);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	if (isString(commentId) === false) {
		return errorReturn(`[${document}] Param commentId must be a valid string id`);
	}

	// Find the comment
	const comment = await commentCollection.findOne({ _id: commentId, dataId });
	if (comment == null) {
		return errorReturn(`[${document}] Comment not found`);
	}

	// Check if comment was soft deleted
	if (comment.deletedAt != null) {
		return errorReturn(`[${document}] Cannot edit a deleted comment`);
	}

	// Check permission: only author or admin can edit
	const isAuthor = (comment._createdBy as WithIdRef | undefined)?._id === user._id;
	const isAdmin = user.admin === true;

	if (isAuthor === false && isAdmin === false) {
		return errorReturn(`[${document}] You don't have permission to edit this comment`);
	}

	const sanitizedText = sanitizeText(text);

	try {
		const updateResult = await commentCollection.findOneAndUpdate(
			{ _id: commentId, dataId },
			{
				$set: {
					text: sanitizedText,
					edited: true,
					_updatedAt: new Date(),
					_updatedBy: pick(user, ['_id', 'group', 'name']),
				},
			},
			{ returnDocument: 'after' },
		);

		if (updateResult == null) {
			return errorReturn(`[${document}] Failed to update comment`);
		}

		await eventManager.sendEvent(document, 'commentUpdate', {
			data: pick(updateResult, ['_id', 'text']),
			full: updateResult,
		});

		return successReturn([updateResult]);
	} catch (e) {
		const error = e as Error;
		logger.error(e, `Comment - Update Error ${error.message}`);

		return errorReturn(`[${document}] Error updating comment - ${error.message}`);
	}
}

export async function deleteComment({ authTokenId, document, dataId, commentId }: DeleteCommentParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user as User);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];
	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	if (isString(commentId) === false) {
		return errorReturn(`[${document}] Param commentId must be a valid string id`);
	}

	// Find the comment
	const comment = await commentCollection.findOne({ _id: commentId, dataId });
	if (comment == null) {
		return errorReturn(`[${document}] Comment not found`);
	}

	// Check if already deleted
	if (comment.deletedAt != null) {
		return errorReturn(`[${document}] Comment is already deleted`);
	}

	// Check permission: only author or admin can delete
	const isAuthor = (comment._createdBy as WithIdRef | undefined)?._id === user._id;
	const isAdmin = user.admin === true;

	if (isAuthor === false && isAdmin === false) {
		return errorReturn(`[${document}] You don't have permission to delete this comment`);
	}

	try {
		// Soft delete: set deletedAt timestamp
		const updateResult = await commentCollection.findOneAndUpdate(
			{ _id: commentId, dataId },
			{
				$set: {
					deletedAt: new Date(),
					_deletedBy: pick(user, ['_id', 'group', 'name']),
				},
			},
			{ returnDocument: 'after' },
		);

		if (updateResult == null) {
			return errorReturn(`[${document}] Failed to delete comment`);
		}

		await eventManager.sendEvent(document, 'commentDelete', {
			data: pick(updateResult, ['_id']),
			full: updateResult,
		});

		return successReturn({ deleted: true });
	} catch (e) {
		const error = e as Error;
		logger.error(e, `Comment - Delete Error ${error.message}`);

		return errorReturn(`[${document}] Error deleting comment - ${error.message}`);
	}
}
