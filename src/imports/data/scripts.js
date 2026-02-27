import BluebirdPromise from 'bluebird';
import moment from 'moment';
import momentzone from 'moment-timezone';
import { createContext, runInContext } from 'node:vm';
import request from 'request';

import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

import { find } from '@imports/data/api';
import { MetaObject } from '@imports/model/MetaObject';
import { stringToDate } from '../data/dateParser';
import { parseDynamicData } from '../data/filterUtils';
import { populateLookupsData } from '../data/populateLookupsData';
import { logger } from '../utils/logger';
import { errorReturn, successReturn } from '../utils/return';

/**
 *
 * @returns {Promise<{ success: boolean, reason?: string, data?: { result?: Record<string, any>, emailsToSend?: EmailToSend[] } }>}
 */
export async function runScriptBeforeValidation({ script, data, user, meta, extraData }) {
	try {
		const contextData = {
			data,
			emails: [],
			user: user != null ? Object.assign({}, user) : undefined,
			console,
			extraData,
			result: {},
		};

		const sandbox = createContext(contextData);
		const scriptToRun = `result = (function(data, emails, user, console) { ${script} })(data, emails, user, console);`;
		await runInContext(scriptToRun, sandbox);

		// Check if scriptBeforeValidation added any e-mails to be sent
		// Accepted values:
		//	emails.push({ from: '', to: '', server: '', subject: '', html: '' });
		//	emails.push({ from: '', to: '', server: '', subject: '', template: '_id', data: {  } });
		//	emails.push({ from: '', to: '', server: '', template: '_id', data: {  } });
		if (sandbox.emails != null && isArray(sandbox.emails) && sandbox.emails.length > 0 && MetaObject.Collections['Message'] != null) {
			const emailsToSend = await BluebirdPromise.all(
				sandbox.emails.map(async email => {
					const resultEmail = Object.assign({}, email);
					if (email.relations != null) {
						resultEmail.data = await populateLookupsData(meta._id, data, email.relations);
					}
					if (email.toPath != null) {
						resultEmail.to = get(resultEmail.data, email.toPath);
					}

					resultEmail.data = stringToDate(resultEmail.data);
					resultEmail.type = 'Email';
					resultEmail.status = 'Send';

					return resultEmail;
				}),
			);

			return successReturn({
				result: sandbox.result ?? {},
				emailsToSend: emailsToSend,
			});
		}

		return successReturn({
			result: sandbox.result ?? {},
		});
	} catch (e) {
		return errorReturn(`Error running script before validation ${e.message}`);
	}
}

/**
 *
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function processValidationScript({ script, validationData, fullData, user }) {
	if (validationData != null) {
		const extraData = await BluebirdPromise.reduce(
			Object.keys(validationData),
			async (acc, validationField) => {
				const validationFilter = validationData[validationField];
				const validationDataFilter = await parseDynamicData(validationFilter, '$this', fullData);
				if (validationDataFilter.success !== true) {
					return acc;
				}

				const fieldResult = await find({
					...validationDataFilter.data,
					contextUser: user,
				});

				if (fieldResult.success === true) {
					acc[validationField] = fieldResult.data;
				}

				return acc;
			},
			{},
		);

		return runValidationScript({ script, data: fullData, user, extraData });
	}

	return runValidationScript({ script, data: fullData, user, extraData: {} });
}

export async function runValidationScript({ script, data, user, extraData }) {
	try {
		const contextData = {
			data,
			user,
			console,
			extraData,
		};

		const sandbox = createContext(contextData);
		const scriptToRun = `result = (function(data, user, console, extraData) { ${script} })(data, user, console, extraData);`;
		await runInContext(scriptToRun, sandbox);

		if (sandbox.result && isObject(sandbox.result)) {
			return sandbox.result;
		} else {
			return successReturn({});
		}
	} catch (e) {
		logger.error(e, `Error running validation script ${e.message}`);
		return errorReturn(`Error running validation script ${e.message}`);
	}
}

export async function runScriptAfterSave({ script, data, user, extraData = {} }) {
	try {
		const contextData = {
			data,
			user,
			console,
			Models: MetaObject.Collections,
			extraData,
			moment,
			momentzone,
			request,
		};

		const sandbox = createContext(contextData);
		const scriptToRun = `result = (async function(data, user, console, Models, extraData) { ${script} })(data, user, console, Models, extraData);`;
		await runInContext(scriptToRun, sandbox);

		if (sandbox.result != null && isObject(sandbox.result)) {
			if (sandbox.result.then != null) {
				const result = await sandbox.result;
				return result || {};
			}
			return sandbox.result;
		} else {
			return {};
		}
	} catch (e) {
		logger.error(e, `runScriptAfterSave error: ${e.message}`);
		return {};
	}
}
