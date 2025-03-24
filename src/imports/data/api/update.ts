import { Span } from '@opentelemetry/api';
import extend from 'lodash/extend';
import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import merge from 'lodash/merge';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import set from 'lodash/set';
import unset from 'lodash/unset';
import { DateTime } from 'luxon';

import { getUserSafe } from '@imports/auth/getUser';
import { TRANSACTION_OPTIONS } from '@imports/consts';
import { dateToString } from '@imports/data/dateParser';
import { isUpdateFromInterfaceUpload, parseFilterObject } from '@imports/data/filterUtils';
import { processCollectionLogin } from '@imports/data/processCollectionLogin';
import { processValidationScript, runScriptAfterSave, runScriptBeforeValidation } from '@imports/data/scripts';
import { client } from '@imports/database';
import { Konsistent, KonsistentWal } from '@imports/konsistent';
import eventManager from '@imports/lib/EventManager';
import { validateAndProcessValueFor } from '@imports/meta/validateAndProcessValueFor';
import { KonFilter } from '@imports/model/Filter';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { EmailToSend, KonectyResult, KonectyResultError, KonectyResultSuccess } from '@imports/types/result';
import { FieldConditions, getAccessFor, getFieldConditions, getFieldPermissions, removeUnauthorizedDataForRead } from '@imports/utils/accessUtils';
import { extractErrorsFromResults } from '@imports/utils/errors';
import { logger } from '@imports/utils/logger';
import { getDuplicateKeyField, isDuplicateKeyError } from '@imports/utils/mongo';
import { randomId } from '@imports/utils/random';
import { errorReturn, successReturn } from '@imports/utils/return';
import { handleTransactionError, retryMongoTransaction } from '@imports/utils/transaction';
import { Promise as BluebirdPromise } from 'bluebird';
import { z } from 'zod';
import { runNamespaceWebhook } from '../namespace';

interface UpdateData {
	ids: Array<{
		_id: string;
		_updatedAt: Date | { $date: Date | string };
	}>;
	data: Record<string, any>;
	_user?: {
		_id: string;
	}[];
}

interface UpdateParams {
	authTokenId?: string;
	document: string;
	data: UpdateData;
	abortAllOnError?: boolean;
	contextUser?: User;
	tracingSpan?: Span;
}

interface UpdateResult {
	full: DataDocument[];
	changed: DataDocument[];
}

const createUpdateIdSchema = (ignoreUpdatedAt: unknown) =>
	z.object({
		_id: z.string(),
		_updatedAt:
			ignoreUpdatedAt !== true
				? z.union([
						z.string(),
						z.date(),
						z.object({
							$date: z.union([z.string(), z.date()]),
						}),
					])
				: z.any().optional(),
	});

export async function update({ authTokenId, document, data, contextUser, tracingSpan, abortAllOnError }: UpdateParams): Promise<KonectyResult<UpdateResult>> {
	tracingSpan?.setAttributes({ document });

	tracingSpan?.addEvent('Get User', { authTokenId, contextUser: contextUser?._id });
	const userResult = await getUserSafe(authTokenId, contextUser);
	if (userResult.success === false) {
		return errorReturn(userResult.errors);
	}
	const user = userResult.data;

	const access = getAccessFor(document, user);
	if (access === false || access.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to update records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	if (isObject(data) === false) {
		return errorReturn(`[${document}] Invalid payload`);
	}

	if (data.ids == null || data.ids.length === 0) {
		return errorReturn(`[${document}] Payload must contain an array of ids with at least one item`);
	}

	if (data.data == null || Object.keys(data.data).length === 0) {
		return errorReturn(`[${document}] Data must have at least one field`);
	}

	// Validate the ids are one of the allowed types
	const UpdateIdSchema = createUpdateIdSchema(metaObject.ignoreUpdatedAt);
	const validateIdsResult = data.ids.map(id => {
		const result = UpdateIdSchema.safeParse(id);
		return result.success;
	});

	if (validateIdsResult.some(result => result === false)) {
		return errorReturn(`[${document}] Each id must contain an string field named _id an date field named _updatedAt`);
	}

	tracingSpan?.addEvent('Calculating update permissions');
	const fieldPermissionResult = Object.keys(data.data).map(fieldName => {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
		}
		return successReturn(null);
	});

	if (fieldPermissionResult.some(result => result.success === false)) {
		return errorReturn(extractErrorsFromResults(fieldPermissionResult));
	}

	if (data._user != null) {
		if (isArray(data._user) === false) {
			return errorReturn(`[${document}] _user must be array`);
		}
		if (data._user.some(newUser => newUser._id !== user._id) === true && access.changeUser !== true) {
			unset(data, '_user');
		}
	}

	const isFromInterfaceUpload = isUpdateFromInterfaceUpload(metaObject, data);

	let isRetry = false;
	const originals: Record<string, DataDocument> = {};
	const dbSession = client.startSession({ defaultTransactionOptions: TRANSACTION_OPTIONS });

	try {
		const transactionResult: KonectyResult<UpdateResult> = await retryMongoTransaction(() =>
			dbSession.withTransaction(async function updateTransaction() {
				tracingSpan?.addEvent('Processing login');

				const processLoginResult = await processCollectionLogin({ meta: metaObject, data: data.data });
				if (processLoginResult.success === false) {
					return processLoginResult;
				}

				const fieldFilterConditions = Object.keys(data.data).reduce<Required<FieldConditions>['UPDATE'][]>((acc, fieldName) => {
					const accessFieldConditions = getFieldConditions(access, fieldName);
					if (accessFieldConditions.UPDATE) {
						acc.push(accessFieldConditions.UPDATE);
					}
					return acc;
				}, []);

				const filter: KonFilter = {
					match: 'and',
					filters: isObject(access.updateFilter) ? [access.updateFilter] : [],
					conditions: fieldFilterConditions?.length > 0 ? fieldFilterConditions : undefined,
				};

				tracingSpan?.addEvent('Parsing filter');
				const updateFilterResult = parseFilterObject(filter, metaObject, { user });

				const query = Object.assign({ _id: { $in: [] } }, updateFilterResult);

				if (isArray(query._id.$in)) {
					data.ids.forEach(id => {
						query._id.$in.push(id._id);
					});
				}

				const options = { session: dbSession };

				if (metaObject.scriptBeforeValidation == null && metaObject.validationScript == null && metaObject.scriptAfterSave == null) {
					set(options, 'fields', {
						_updatedAt: 1,
					});
				}

				tracingSpan?.addEvent('Finding records to update', { query });
				const existsRecords = await collection.find(query, options).toArray();
				for (const record of existsRecords) {
					originals[record._id] = record;
				}

				// If the number of records found is different from the number of ids, the user doesn't have permission or not found
				const hasForbiddenRecords = existsRecords.length !== data.ids.length;
				if (hasForbiddenRecords) {
					return errorReturn(`[${document}] You don't have permission to update records ${Object.keys(originals).join(', ')} or they don't exists`);
				}

				//TODO: refactor
				// if (metaObject.ignoreUpdatedAt !== true && isRetry === false && isFromInterfaceUpload === false) {
				// 	// Filter the records where
				// 	const outdateRecords = data.ids.filter(id => {
				// 		const record = originals[id._id];
				// 		if (record == null) {
				// 			return true;
				// 		}
				// 		const recordUpdatedDate = DateTime.fromJSDate(record._updatedAt);
				// 		const updatedDate = getUpdatedDate(id._updatedAt);

				// 		logger.info(
				// 			{
				// 				record: record._updatedAt instanceof Date,
				// 				updatedDate: typeof updatedDate,
				// 				diff: DateTime.fromJSDate(new Date(record._updatedAt)).diff(updatedDate).milliseconds,
				// 			},
				// 			'vish',
				// 		);

				// 		if (updatedDate == null || DateTime.fromJSDate(record._updatedAt).diff(updatedDate).milliseconds > 500) {
				// 			return true;
				// 		}
				// 		return false;
				// 	});

				// 	if (outdateRecords.length > 0) {
				// 		const mapOfFieldsToUpdateForHistoryQuery = Object.keys(data.data).reduce((acc, fieldName) => {
				// 			acc.push({ [`data.${fieldName}`]: { $exists: 1 } });
				// 			return acc;
				// 		}, []);
				// 		const outOfDateQuery = {
				// 			$or: outdateRecords.map(record => ({
				// 				dataId: record._id,
				// 				createdAt: {
				// 					$gt: getUpdatedDate(record._updatedAt)?.toJSDate(),
				// 				},
				// 				$or: mapOfFieldsToUpdateForHistoryQuery,
				// 			})),
				// 		};

				// 		const historyCollection = MetaObject.Collections[`${document}.History`];

				// 		tracingSpan?.addEvent('Finding out of date records', { outOfDateQuery });
				// 		const outOfDateRecords = await historyCollection.find(outOfDateQuery, { session: dbSession }).toArray();

				// 		if (outOfDateRecords.length > 0) {
				// 			const errorMessage = outOfDateRecords.reduce((acc, history) => {
				// 				Object.keys(data.data).forEach(fieldName => {
				// 					if (history.data[fieldName] != null) {
				// 						acc.push(
				// 							`[${document}] Record ${history.dataId} is out of date, field ${fieldName} was updated at ${DateTime.fromJSDate(history.createdAt).toISO()} by ${get(history, 'createdBy.name', 'Unknown')}`,
				// 						);
				// 					}
				// 				});
				// 				return acc;
				// 			}, []);

				// 			if (errorMessage.length > 0) {
				// 				return errorReturn(errorMessage);
				// 			}
				// 		}
				// 	}
				// }

				isRetry = true;
				const emailsToSend: EmailToSend[] = [];

				const updateResults = await BluebirdPromise.mapSeries<DataDocument, KonectyResult<DataDocument>>(existsRecords, async record => {
					const bodyData: Record<string, any> = {};

					tracingSpan?.addEvent('Validate&ProcessValueFor all fields');
					const validateResult = await BluebirdPromise.mapSeries(Object.keys(data.data), async fieldName => {
						if (bodyData[fieldName] == null) {
							const result = await validateAndProcessValueFor(
								{
									meta: metaObject,
									fieldName,
									value: data.data[fieldName],
									actionType: 'update',
									objectOriginalValues: record,
									objectNewValues: bodyData,
									idsToUpdate: query._id.$in,
								},
								dbSession,
							);
							if (result.success === false) {
								return result;
							}
							if (result.data !== undefined) {
								set(bodyData, fieldName, result.data);
							}
						}
						return successReturn(null);
					});

					if (validateResult.some(result => result.success === false)) {
						return errorReturn(extractErrorsFromResults(validateResult));
					}

					// Run scripts
					if (metaObject.scriptBeforeValidation != null) {
						tracingSpan?.addEvent('Running scriptBeforeValidation');
						const extraData = {
							original: originals[record._id],
							request: data.data,
							validated: bodyData,
						};
						const scriptResult = await runScriptBeforeValidation({
							script: metaObject.scriptBeforeValidation,
							data: extend({}, record, data.data, bodyData),
							user,
							meta: metaObject,
							extraData,
						});

						if (scriptResult.success === false) {
							return scriptResult as KonectyResultError;
						}

						if (scriptResult.data?.result != null && isObject(scriptResult.data.result)) {
							Object.assign(bodyData, scriptResult.data.result);
						}
						if (scriptResult.data?.emailsToSend != null && isArray(scriptResult.data.emailsToSend)) {
							emailsToSend.push(...scriptResult.data.emailsToSend);
						}
					}

					if (metaObject.validationScript != null) {
						tracingSpan?.addEvent('Running validation script');
						const validationScriptResult = await processValidationScript({
							script: metaObject.validationScript,
							validationData: metaObject.validationData,
							fullData: extend({}, record, bodyData),
							user,
						});
						if (validationScriptResult.success === false) {
							logger.debug(`Update - Script Validation Error - ${validationScriptResult.reason}`);
							return validationScriptResult as KonectyResultError;
						}
					}

					// Create the update object, with $set and $unset
					const updateOperation = Object.keys(bodyData).reduce((acc, key) => {
						if (bodyData[key] === undefined) return acc;
						if (bodyData[key] === null) {
							set(acc, `$unset.${key}`, 1);
						} else {
							set(acc, `$set.${key}`, bodyData[key]);
						}
						return acc;
					}, {});

					// If any of the fields doesnt ignoreHistory, add the updatedAt and updatedBy fields
					const ignoreUpdate = Object.keys(bodyData).every(key => metaObject?.fields?.[key]?.ignoreHistory === true);
					if (ignoreUpdate === false) {
						set(updateOperation, '$set._updatedAt', DateTime.local().toJSDate());
						set(
							updateOperation,
							'$set._updatedBy',
							Object.assign({}, pick(user, ['_id', 'name', 'group']), {
								ts: get(updateOperation, '$set._updatedAt'),
							}),
						);
					}

					const filter = {
						_id: record._id,
					};

					try {
						tracingSpan?.addEvent('Updating record', { filterDetails: JSON.stringify(filter), operationDetails: JSON.stringify(updateOperation) });
						await collection.updateOne(filter, updateOperation, { session: dbSession });

						return successReturn({ _id: record._id, ...bodyData });
					} catch (e) {
						const error = e as Error;
						await handleTransactionError(error);

						logger.error(error, `Error updating record ${MetaObject.Namespace.ns}.${document}: ${error.message}`);
						tracingSpan?.addEvent('Error updating record', { error: error.message });
						tracingSpan?.setAttributes({ error: error.message });

						if (isDuplicateKeyError(e)) {
							const duplicateField = getDuplicateKeyField(e);
							return errorReturn(`[${document}] Campo único não respeitado: ${duplicateField}`);
						}
						return errorReturn(`[${document}] ${error.message}`);
					}
				});

				if (updateResults.some(result => result.success === false)) {
					await dbSession.abortTransaction();
					return errorReturn(extractErrorsFromResults(updateResults));
				}

				// Write Konsistent changes
				const walResults = await BluebirdPromise.map(
					updateResults as KonectyResultSuccess<DataDocument>[],
					async result => await Konsistent.writeAheadLog(document, 'update', result.data, user, dbSession),
					{
						concurrency: 5,
					},
				);

				if (walResults.some(result => result.success === false)) {
					await dbSession.abortTransaction();
					return errorReturn(extractErrorsFromResults(walResults));
				}

				const updatedIs = updateResults.map(result => (result as KonectyResultSuccess<DataDocument>).data._id);

				// OnUpdate Webhhok
				if (updatedIs.length > 0) {
					await runNamespaceWebhook({ action: 'update', ids: updatedIs, metaName: document, user });

					const updatedQuery = {
						_id: {
							$in: updatedIs,
						},
					};

					if (isObject(access.readFilter)) {
						const readFilter = parseFilterObject(access.readFilter, metaObject, { user });

						merge(updatedQuery, readFilter);
					}

					const updatedRecords = await collection.find(updatedQuery, { session: dbSession, readPreference: 'primary' }).toArray();

					if (metaObject.scriptAfterSave != null) {
						tracingSpan?.addEvent('Running scriptAfterSave');
						await runScriptAfterSave({ script: metaObject.scriptAfterSave, data: updatedRecords, user, extraData: { original: existsRecords } });
					}

					// Process sync Konsistent
					for await (const newRecord of updatedRecords) {
						const originalRecord = originals[newRecord._id];

						try {
							const konsistentWal = walResults.find(wal => get(wal, 'data._id') === newRecord._id) as KonectyResultSuccess<KonsistentWal>;
							if (konsistentWal == null) {
								throw new Error(`Konsistent WAL not found for record ${newRecord._id}`);
							}

							await Konsistent.processChangeSync(document, 'update', user, { originalRecord, newRecord }, dbSession);
							await Konsistent.processChangeAsync(konsistentWal.data);
						} catch (e) {
							const error = e as Error;
							await handleTransactionError(error, dbSession);

							logger.error(error, `Error on processIncomingChange ${document}: ${error.message}`);
							tracingSpan?.addEvent('Error on Konsistent', { error: error.message });

							return errorReturn(`[${document}] Error on Konsistent: ${error.message}`);
						}
					}

					const responseData = updatedRecords.map(record => removeUnauthorizedDataForRead(access, record, user, metaObject)).map(record => dateToString(record));

					if (emailsToSend.length > 0) {
						tracingSpan?.addEvent('Sending emails');

						const messagesCollection = MetaObject.Collections['Message'];
						const now = DateTime.local().toJSDate();
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
							{ session: dbSession },
						);
					}

					// Full is the full affected documents,    Changed are the changed props only
					return successReturn({ full: responseData, changed: updateResults.map(r => (r as KonectyResultSuccess<DataDocument>).data) });
				}
			}),
		);

		if (transactionResult != null && transactionResult.success != null) {
			tracingSpan?.addEvent('Operation result', { operationResult: JSON.stringify(omit(transactionResult, ['data'])) });

			if (transactionResult.success === false) {
				return transactionResult;
			}

			// Process events and messages after transaction completes successfully
			const fullDocs = transactionResult.data?.full;
			if (fullDocs && fullDocs?.length > 0) {
				const changedDocs = fullDocs.reduce<Record<string, DataDocument>>(
					(acc, doc) => ({
						...acc,
						[doc._id]: transactionResult.data.changed.find(changed => changed._id === doc._id) as DataDocument,
					}),
					{},
				);

				// Send events
				try {
					await Promise.all(
						fullDocs.map(record =>
							eventManager.sendEvent(document, 'update', {
								data: changedDocs[record._id],
								original: originals[record._id],
								full: record,
							}),
						),
					);
				} catch (e) {
					logger.error(e, `Error sending events: ${(e as Error).message}`);
				}
			}

			return successReturn(transactionResult.data.full);
		}
	} catch (e) {
		if (e instanceof Error) {
			tracingSpan?.addEvent('Error on transaction', { error: e.message });
			tracingSpan?.setAttributes({ error: e.message });
			logger.error(e, `Error on update ${MetaObject.Namespace.ns}.${document}: ${e.message}`);
		}
	} finally {
		tracingSpan?.addEvent('Ending session');
		dbSession.endSession();
	}

	return errorReturn(`[${document}] Error on update, there is no affected record`);
}
