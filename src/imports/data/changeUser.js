import Bluebird from 'bluebird';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { MetaObject } from '@imports/model/MetaObject';

import { getUserSafe } from '@imports/auth/getUser';
import { Konsistent } from '@imports/konsistent';
import { errorReturn, successReturn } from '@imports/utils/return';
import { stringToDate } from '../data/dateParser';
import { getNextUserFromQueue } from '../meta/getNextUserFromQueue';
import { validateAndProcessValueFor } from '../meta/validateAndProcessValueFor';
import { getAccessFor } from '../utils/accessUtils';
import { runScriptBeforeValidation, runScriptAfterSave } from '../data/scripts';
import extend from 'lodash/extend';
import set from 'lodash/set';
import cloneDeep from 'lodash/cloneDeep';
import { DateTime } from 'luxon';
import pick from 'lodash/pick';
import { randomId } from '../utils/random';

/**
 * Executa os hooks (beforeValidation e afterSave) se a flag changeUserRunHooks estiver ativa
 * Retorna o update modificado ou erro se o script falhar
 */
async function processBeforeValidation({ meta, originalRecord, update, requestData, user }) {
	if (meta.changeUserRunHooks !== true || originalRecord == null || meta.scriptBeforeValidation == null) {
		return { update, shouldContinue: true };
	}

	// Prepara extraData
	const extraData = {
		original: originalRecord,
		request: requestData,
		validated: {},
	};

	// Prepara data do update para ser validada: extend({}, record, data.data, lookupValues)
	const dataToValidate = extend({}, originalRecord, requestData, {});

	// Executa beforeValidation
	const scriptResult = await runScriptBeforeValidation({
		script: meta.scriptBeforeValidation,
		data: dataToValidate,
		user,
		meta,
		extraData,
	});

	// Se o script retornar erro, interrompe
	if (scriptResult.success === false) {
		return { update, shouldContinue: false, error: scriptResult };
	}

	// Prepara o update que será aplicado (deep clone para evitar race condition)
	let updateToApply = cloneDeep(update);

	// Aplica as modificações retornadas ao update
	if (scriptResult.data?.result != null && isObject(scriptResult.data.result)) {
		const modifications = scriptResult.data.result;

		// Garante que $set existe
		if (updateToApply.$set == null) {
			updateToApply.$set = {};
		}

		// Aplica as modificações ao $set
		Object.keys(modifications).forEach(key => {
			if (modifications[key] === null) {
				// Se o valor for null, remove o campo
				if (updateToApply.$unset == null) {
					updateToApply.$unset = {};
				}
				updateToApply.$unset[key] = 1;
				delete updateToApply.$set[key];
			} else {
				// Aplica a modificação ao $set
				set(updateToApply.$set, key, modifications[key]);
			}

			// Se o script modificar _user, remove operadores conflitantes ($addToSet, $pull)
			// MongoDB não permite múltiplos operadores no mesmo campo
			if (key === '_user') {
				if (updateToApply.$addToSet != null && updateToApply.$addToSet._user != null) {
					delete updateToApply.$addToSet._user;
					if (Object.keys(updateToApply.$addToSet).length === 0) {
						delete updateToApply.$addToSet;
					}
				}
				if (updateToApply.$pull != null && updateToApply.$pull._user != null) {
					delete updateToApply.$pull._user;
					if (Object.keys(updateToApply.$pull).length === 0) {
						delete updateToApply.$pull;
					}
				}
			}
		});
	}

	return {
		update: updateToApply,
		shouldContinue: true,
		emailsToSend: scriptResult.data?.emailsToSend,
	};
}

/**
 * Executa afterSave seguindo o padrão do update
 */
async function processAfterSave({ meta, originalRecord, updatedRecord, user }) {
	if (meta.changeUserRunHooks === true && originalRecord != null && meta.scriptAfterSave != null) {
		await runScriptAfterSave({
			script: meta.scriptAfterSave,
			data: [updatedRecord],
			user,
			extraData: { original: [originalRecord] },
		});
	}
}

/**
 * Processa emails retornados pelo beforeValidation
 */
async function processEmailsToSend(emailsToSend, user) {
	if (emailsToSend.length === 0) {
		return;
	}

	const messagesCollection = MetaObject.Collections['Message'];
	if (messagesCollection == null) {
		return;
	}

	const now = DateTime.local().toJSDate();
	try {
		await messagesCollection.insertMany(
			emailsToSend.map(email =>
				Object.assign(
					{},
					{
						_id: randomId(),
						_createdAt: now,
						_createdBy: pick(user, ['_id', 'name', 'group']),
						_updatedAt: now,
						_updatedBy: { ...pick(user, ['_id', 'name', 'group']), ts: now },
					},
					email,
				),
			),
		);
	} catch (e) {
		// Log erro mas não falha a operação
		console.error(`Error inserting emails from changeUser:`, e);
	}
}

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

	const update = {
		$addToSet: {
			_user: {
				$each: validateResult.data.map(user => stringToDate(user)),
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

	const emailsToSend = [];
	const updateResults = await Bluebird.map(
		ids,
		async id => {
			try {
				// Busca o registro original antes de atualizar (para os hooks)
				const originalRecord = meta.changeUserRunHooks === true ? await MetaObject.Collections[document].findOne({ _id: id }) : null;

				// Prepara os dados que serão atualizados
				const newUserData = [...(originalRecord?._user || []), ...validateResult.data.map(user => stringToDate(user))];
				const requestData = { _user: newUserData };

				// Executa beforeValidation antes do update
				const beforeValidationResult = await processBeforeValidation({
					meta,
					originalRecord,
					update,
					requestData,
					user,
				});

				if (beforeValidationResult.shouldContinue === false) {
					return beforeValidationResult.error;
				}

				// Coleta emails para enviar
				if (beforeValidationResult.emailsToSend != null && isArray(beforeValidationResult.emailsToSend)) {
					emailsToSend.push(...beforeValidationResult.emailsToSend);
				}

				const updateToApply = beforeValidationResult.update;

				const result = await MetaObject.Collections[document].findOneAndUpdate({ _id: id }, updateToApply, { returnDocument: 'after', includeResultMetadata: false });
				if (result == null) return successReturn(null);

				await Konsistent.processChangeSync(document, 'update', user, {
					originalRecord: { _id: id, _user: undefined },
					newRecord: { _id: id, _user: result._user },
				});

				// Executa afterSave depois do update
				await processAfterSave({ meta, originalRecord, updatedRecord: result, user });

				return successReturn(result);
			} catch (e) {
				return errorReturn(e.message);
			}
		},
		{ concurrency: 10 },
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

	// Processa emails para enviar (se houver)
	await processEmailsToSend(emailsToSend, user);

	return successReturn(null);
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

	const emailsToSend = [];
	const updateResults = await Bluebird.map(
		ids,
		async id => {
			try {
				// Busca o registro original antes de atualizar (para os hooks)
				const originalRecord = meta.changeUserRunHooks === true ? await MetaObject.Collections[document].findOne({ _id: id }) : null;

				// Prepara os dados que serão atualizados
				const newUserData = (originalRecord?._user || []).filter(u => !userIds.includes(u._id));
				const requestData = { _user: newUserData };

				// Executa beforeValidation antes do update
				const beforeValidationResult = await processBeforeValidation({
					meta,
					originalRecord,
					update,
					requestData,
					user,
				});

				if (beforeValidationResult.shouldContinue === false) {
					return beforeValidationResult.error;
				}

				// Coleta emails para enviar
				if (beforeValidationResult.emailsToSend != null && isArray(beforeValidationResult.emailsToSend)) {
					emailsToSend.push(...beforeValidationResult.emailsToSend);
				}

				const updateToApply = beforeValidationResult.update;

				const result = await MetaObject.Collections[document].findOneAndUpdate(
					{
						_id: id,
						'_user._id': { $in: userIds },
					},
					updateToApply,
					{ returnDocument: 'after', includeResultMetadata: false },
				);
				if (result == null) return successReturn(null);

				await Konsistent.processChangeSync(document, 'update', user, {
					originalRecord: { _id: id, _user: undefined },
					newRecord: { _id: id, _user: result._user },
				});

				// Executa afterSave depois do update
				await processAfterSave({ meta, originalRecord, updatedRecord: result, user });

				return successReturn(result);
			} catch (e) {
				return errorReturn(e.message);
			}
		},
		{ concurrency: 10 },
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

	// Processa emails para enviar (se houver)
	await processEmailsToSend(emailsToSend, user);

	return successReturn(null);
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
	const update = {
		$set: {
			_user: validateResult.data.map(user => stringToDate(user)),
			_updatedAt: now,
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
				ts: now,
			},
		},
	};

	const emailsToSend = [];
	const updateResults = await Bluebird.map(
		ids,
		async id => {
			try {
				// Busca o registro original antes de atualizar (para os hooks)
				const originalRecord = meta.changeUserRunHooks === true ? await MetaObject.Collections[document].findOne({ _id: id }) : null;

				// Prepara os dados que serão atualizados (simula o resultado após o update)
				const newUserData = validateResult.data.map(user => stringToDate(user));
				const requestData = { _user: newUserData };

				// Executa beforeValidation ANTES do update (seguindo padrão do update)
				const beforeValidationResult = await processBeforeValidation({
					meta,
					originalRecord,
					update,
					requestData,
					user,
				});

				if (beforeValidationResult.shouldContinue === false) {
					return beforeValidationResult.error;
				}

				// Coleta emails para enviar
				if (beforeValidationResult.emailsToSend != null && isArray(beforeValidationResult.emailsToSend)) {
					emailsToSend.push(...beforeValidationResult.emailsToSend);
				}

				const updateToApply = beforeValidationResult.update;

				const result = await MetaObject.Collections[document].findOneAndUpdate({ _id: id }, updateToApply, { returnDocument: 'after', includeResultMetadata: false });
				if (result == null) return successReturn(null);

				await Konsistent.processChangeSync(document, 'update', user, {
					originalRecord: { _id: id, _user: undefined },
					newRecord: { _id: id, _user: result._user },
				});

				// Executa afterSave depois do update
				await processAfterSave({ meta, originalRecord, updatedRecord: result, user });

				return successReturn(result);
			} catch (e) {
				return errorReturn(e.message);
			}
		},
		{ concurrency: 10 },
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

	// Processa emails para enviar (se houver)
	await processEmailsToSend(emailsToSend, user);

	return successReturn(null);
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

	const newUser = stringToDate(resultOfValidation.data[0]);
	const update = {
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

	const records = await MetaObject.Collections[document]
		.find({ _id: { $in: ids }, '_user._id': from._id })
		.project({ _user: 1 })
		.toArray();

	const emailsToSend = [];
	const updateResults = await Bluebird.map(
		records,
		async record => {
			try {
				// Busca o registro original completo antes de atualizar (para os hooks)
				const originalRecord = meta?.changeUserRunHooks === true ? await MetaObject.Collections[document].findOne({ _id: record._id }) : record;

				const newUsers = [...record._user];

				const userToRemoveIndex = newUsers.findIndex(user => user._id === from._id);
				if (userToRemoveIndex === -1) return successReturn(null);

				newUsers[userToRemoveIndex] = newUser;
				update.$set._user = newUsers;

				// Prepara os dados que serão atualizados
				const requestData = { _user: newUsers };

				// Executa beforeValidation antes do update
				const beforeValidationResult = await processBeforeValidation({
					meta,
					originalRecord,
					update,
					requestData,
					user,
				});

				if (beforeValidationResult.shouldContinue === false) {
					return beforeValidationResult.error;
				}

				// Coleta emails para enviar
				if (beforeValidationResult.emailsToSend != null && isArray(beforeValidationResult.emailsToSend)) {
					emailsToSend.push(...beforeValidationResult.emailsToSend);
				}

				const updateToApply = beforeValidationResult.update;

				const result = await MetaObject.Collections[document].findOneAndUpdate({ _id: record._id }, updateToApply, {
					returnDocument: 'after',
					includeResultMetadata: false,
				});

				if (result == null) return successReturn(null);

				await Konsistent.processChangeSync(document, 'update', user, {
					originalRecord: { _id: record._id, _user: undefined },
					newRecord: { _id: record._id, _user: result._user },
				});

				// Executa afterSave depois do update
				if (meta?.changeUserRunHooks === true && originalRecord != null && meta.scriptAfterSave != null) {
					await runScriptAfterSave({
						script: meta.scriptAfterSave,
						data: [result],
						user,
						extraData: { original: [originalRecord] },
					});
				}

				return successReturn(result);
			} catch (e) {
				return errorReturn(e.message);
			}
		},
		{ concurrency: 10 },
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

	// Processa emails para enviar (se houver)
	await processEmailsToSend(emailsToSend, user);

	return successReturn(null);
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
	const update = {
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

	const records = await MetaObject.Collections[document]
		.find({ _id: { $in: ids }, '_user.active': false })
		.project({ _user: 1 })
		.toArray();

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			errors: [{ message: `[withMetaForDocument] Document [${document}] does not exists` }],
		};
	}

	const emailsToSend = [];
	const updateResults = await Bluebird.map(
		records,
		async record => {
			try {
				// Busca o registro original antes de atualizar (para os hooks)
				const originalRecord = meta?.changeUserRunHooks === true ? await MetaObject.Collections[document].findOne({ _id: record._id }) : record;

				const newUsers = [].concat(record._user).filter(user => user.active === true);
				if (newUsers.length === record._user.length) return successReturn(null);

				update.$set._user = newUsers;

				// Prepara os dados que serão atualizados
				const requestData = { _user: newUsers };

				// Executa beforeValidation antes do update
				const beforeValidationResult = await processBeforeValidation({
					meta,
					originalRecord,
					update,
					requestData,
					user,
				});

				if (beforeValidationResult.shouldContinue === false) {
					return beforeValidationResult.error;
				}

				// Coleta emails para enviar
				if (beforeValidationResult.emailsToSend != null && isArray(beforeValidationResult.emailsToSend)) {
					emailsToSend.push(...beforeValidationResult.emailsToSend);
				}

				const updateToApply = beforeValidationResult.update;

				const result = await MetaObject.Collections[document].findOneAndUpdate({ _id: record._id }, updateToApply, {
					returnDocument: 'after',
					includeResultMetadata: false,
				});
				if (result == null) return successReturn(null);

				await Konsistent.processChangeSync(document, 'update', user, {
					originalRecord: { _id: record._id, _user: undefined },
					newRecord: { _id: record._id, _user: result._user },
				});

				// Executa afterSave depois do update
				if (meta?.changeUserRunHooks === true && originalRecord != null && meta.scriptAfterSave != null) {
					await runScriptAfterSave({
						script: meta.scriptAfterSave,
						data: [result],
						user,
						extraData: { original: [originalRecord] },
					});
				}

				return successReturn(result);
			} catch (e) {
				return errorReturn(e.message);
			}
		},
		{ concurrency: 10 },
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

	// Processa emails para enviar (se houver)
	await processEmailsToSend(emailsToSend, user);

	return successReturn(null);
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
				value: userQueueResult.data.user,
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
