import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { MetaObject } from '@imports/model/MetaObject';

import { getAccessFor } from '../utils/accessUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { validateAndProcessValueFor } from '../meta/validateAndProcessValueFor';
import { stringToDate } from '../data/dateParser';
import { getNextUserFromQueue } from '../meta/getNextUserFromQueue';

function validateRequest({ document, ids, users, access }) {
	// Verify if user have permission to update record
	if (access.isUpdatable !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to update this record` }],
		};
	}

	if (access.changeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to change users` }],
		};
	}

	if (!isArray(users) || users.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [users] as an array with at least one item` }],
		};
	}

	if (users.some(user => !isObject(user) || !isString(user._id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each user must be and Object with an [_id] as String` }],
		};
	}

	if (!isArray(ids) || ids.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [ids] as an array with at least one item` }],
		};
	}

	if (ids.some(id => !isString(id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each id must be String` }],
		};
	}

	return { success: true };
}

/* Add users
	@param authTokenId
	@param document
	@param ids
	@param users
*/

export async function addUser({ authTokenId, document, ids, users }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);
	if (access === false || access.addUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to add users` }],
		};
	}

	const validate = validateRequest({ document, ids, users, access });
	if (validate.success === false) {
		return validate;
	}

	if (document == null) {
		return {
			success: false,
			errors: [{ message: `[withAccessForDocument] No documentName was passaed` }],
		};
	}

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	const validateResult = await validateAndProcessValueFor({
		meta,
		fieldName: '_user',
		value: users,
		actionType: 'update',
		objectOriginalValues: {},
		objectNewValues: {},
		idsToUpdate: ids,
	});

	if (validateResult.success === false) {
		return validateResult;
	}
	const now = new Date();

	const updateResults = await Promise.all(
		validateResult.data.map(async newUser => {
			const query = {
				_id: {
					$in: ids,
				},
				'_user._id': {
					$ne: newUser._id,
				},
			};

			const update = {
				$push: {
					_user: {
						$each: [stringToDate(newUser)],
						$position: 0,
					},
				},
				$set: {
					_updatedAt: now,
					_updatedBy: {
						_id: user._id,
						name: user.name,
						group: user.group,
						ts: now,
					},
				},
			};

			try {
				await MetaObject.Collections[document].updateMany(query, update);
				return { success: true };
			} catch (e) {
				return {
					success: false,
					errors: [
						{
							message: e.message,
						},
					],
				};
			}
		}),
	);

	if (updateResults.some(result => result.success === false)) {
		return {
			success: false,
			errors: updateResults.reduce((acc, result) => {
				if (result.success === false) {
					acc.push(...result.errors);
				}
				return acc;
			}, []),
		};
	}

	return { success: true };
}

/* Remove users
	@param authTokenId
	@param document
	@param ids
	@param users
*/

export async function removeUser({ authTokenId, document, ids, users }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.removeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to remove users` }],
		};
	}

	const validate = validateRequest({ document, ids, users, access });
	if (validate.success === false) {
		return validate;
	}

	if (document == null) {
		return {
			success: false,
			errors: [{ message: `[withAccessForDocument] No documentName was passaed` }],
		};
	}

	const meta = MetaObject.Meta[document];

	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	const userIds = users.map(user => user._id);

	const now = new Date();

	const query = {
		_id: {
			$in: ids,
		},
		'_user._id': {
			$in: userIds,
		},
	};

	const update = {
		$pull: {
			_user: {
				_id: {
					$in: userIds,
				},
			},
		},
		$set: {
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	try {
		await MetaObject.Collections[document].updateMany(query, update);
		return { success: true };
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}
}

/* Define users
	@param authTokenId
	@param document
	@param ids
	@param users
*/

// PAREI AQUI

export async function defineUser({ authTokenId, document, ids, users }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.defineUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to define users` }],
		};
	}

	const validate = validateRequest({ document, ids, users, access });
	if (validate.success === false) {
		return validate;
	}

	if (document == null) {
		return {
			success: false,
			errors: [{ message: `[withAccessForDocument] No documentName was passaed` }],
		};
	}

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	const validateResult = await validateAndProcessValueFor({
		meta,
		fieldName: '_user',
		value: users,
		actionType: 'update',
		objectOriginalValues: {},
		objectNewValues: {},
		idsToUpdate: ids,
	});

	if (validateResult.success === false) {
		return validateResult;
	}

	const now = new Date();

	const validatedUsers = validateResult.data;

	const query = {
		_id: {
			$in: ids,
		},
	};

	const update = {
		$set: {
			_user: validatedUsers.map(user => stringToDate(user)),
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	try {
		await MetaObject.Collections[document].updateMany(query, update);
		return { success: true };
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}
}

/* Replace users
	@param authTokenId
	@param document
	@param ids
	@param users
*/

export async function replaceUser({ authTokenId, document, ids, from, to }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.isUpdatable !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to update this record` }],
		};
	}

	if (access.changeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to change users` }],
		};
	}

	if (document == null) {
		return {
			success: false,
			errors: [{ message: `[withAccessForDocument] No documentName was passaed` }],
		};
	}

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	if (!isObject(from) || !isString(from._id)) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [from] as an Object with an [_id] as String` }],
		};
	}

	if (!isObject(to) || !isString(to._id)) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [to] as an Object with an [_id] as String` }],
		};
	}

	if (!isArray(ids) || ids.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [ids] as an array with at least one item` }],
		};
	}

	if (ids.some(id => !isString(id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each id must be String` }],
		};
	}

	const resultOfValidation = await validateAndProcessValueFor({
		meta,
		fieldName: '_user',
		value: [to],
		actionType: 'update',
		objectOriginalValues: {},
		objectNewValues: {},
		idsToUpdate: ids,
	});
	if (resultOfValidation.success === false) {
		return resultOfValidation;
	}

	const now = new Date();

	const query = {
		_id: {
			$in: ids,
		},
		'_user._id': from._id,
	};

	const update = {
		$push: {
			_user: {
				$each: resultOfValidation.data.map(user => stringToDate(user)),
				$position: 0,
			},
		},
		$set: {
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	try {
		await MetaObject.Collections[document].updateMany(query, update);
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}

	const removeUpdate = {
		$pull: {
			_user: {
				_id: from._id,
			},
		},
		$set: {
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	try {
		await MetaObject.Collections[document].updateMany(query, removeUpdate);
		return { success: true };
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}
}

/* Count inactive users
	@param authTokenId
	@param document
	@param ids
*/

export async function countInactive({ authTokenId, document, ids }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.removeInactiveUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to remove inactive users` }],
		};
	}

	if (access.isUpdatable !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to update this record` }],
		};
	}

	if (access.changeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to change users` }],
		};
	}

	if (!isArray(ids) || ids.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [ids] as an array with at least one item` }],
		};
	}

	if (ids.some(id => !isString(id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each id must be String` }],
		};
	}

	const query = {
		_id: {
			$in: ids,
		},
		'_user.active': false,
	};

	try {
		const count = await MetaObject.Collections[document].countDocuments(query);
		return {
			success: true,
			count,
		};
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}
}

/* Remove inactive users
	@param authTokenId
	@param document
	@param ids
*/

export async function removeInactive({ authTokenId, document, ids }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.removeInactiveUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to remove inactive users` }],
		};
	}

	if (access.isUpdatable !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to update this record` }],
		};
	}

	if (access.changeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to change users` }],
		};
	}

	if (!isArray(ids) || ids.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [ids] as an array with at least one item` }],
		};
	}

	if (ids.some(id => !isString(id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each id must be String` }],
		};
	}

	const now = new Date();

	const query = {
		_id: {
			$in: ids,
		},
		'_user.active': false,
	};

	const update = {
		$pull: {
			_user: {
				active: false,
			},
		},
		$set: {
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	try {
		await MetaObject.Collections[document].updateMany(query, update);
		return { success: true };
	} catch (e) {
		return {
			success: false,
			errors: [
				{
					message: e.message,
				},
			],
		};
	}
}

/* Set queue and user
	@param authTokenId
	@param document
	@param ids
	@param queue
*/

export async function setQueue({ authTokenId, document, ids, queue }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return {
			success,
			errors,
		};
	}

	const access = getAccessFor(document, user);

	if (access === false || access.defineUserWithQueue !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to define users using queue` }],
		};
	}

	if (access.isUpdatable !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to update this record` }],
		};
	}

	if (access.changeUser !== true) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission to change users` }],
		};
	}

	if (document == null) {
		return {
			success: false,
			errors: [{ message: `[withAccessForDocument] No documentName was passaed` }],
		};
	}

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	if (!isArray(ids) || ids.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [ids] as an array with at least one item` }],
		};
	}

	if (ids.some(id => !isString(id))) {
		return {
			success: false,
			errors: [{ message: `[${document}] Each id must be String` }],
		};
	}

	if (!isObject(queue) || !isString(queue._id)) {
		return {
			success: false,
			errors: [{ message: `[${document}] You need to provide the property [queue] as an Object with an [_id] as String` }],
		};
	}

	const validateResult = await validateAndProcessValueFor({
		meta,
		fieldName: 'queue',
		value: queue,
		actionType: 'update',
		objectOriginalValues: {},
		objectNewValues: {},
		idsToUpdate: ids,
	});

	if (validateResult.success === false) {
		return validateResult;
	}

	const now = new Date();

	const updateResults = await Promise.all(
		ids.map(async id => {
			const userQueueResult = await getNextUserFromQueue(queue._id, user);
			if (userQueueResult.success === false) {
				return userQueueResult;
			}
			const newUserResult = await validateAndProcessValueFor({
				meta,
				fieldName: '_user',
				value: userQueueResult.data,
				actionType: 'update',
				objectOriginalValues: {},
				objectNewValues: {},
				idsToUpdate: [id],
			});

			if (newUserResult.success === false) {
				return newUserResult;
			}

			const query = {
				_id: id,
			};

			const update = {
				$set: {
					queue: validateResult.data,
					_user: newUserResult.data.map(user => stringToDate(user)),
					_updatedAt: now,
					_updatedBy: {
						_id: user._id,
						name: user.name,
						group: user.group,
						ts: now,
					},
				},
			};

			try {
				await MetaObject.Collections[document].updateOne(query, update);
				return { success: true };
			} catch (e) {
				return {
					success: false,
					errors: [
						{
							message: e.message,
						},
					],
				};
			}
		}),
	);

	if (updateResults.some(result => result.success === false)) {
		return {
			success: false,
			errors: updateResults.reduce((acc, result) => {
				if (result.success === false) {
					acc.push(...result.errors);
				}
				return acc;
			}, []),
		};
	}

	return { success: true };
}
