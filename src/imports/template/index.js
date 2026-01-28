import { createContext, runInContext } from 'node:vm';
import lodash from 'lodash';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '../utils/logger';
import path from 'node:path';
import { templatePath } from '../utils/templatesPath';
import { readFile } from 'node:fs/promises';
import { DateTime } from 'luxon';
import ClayHandlebars from 'clayhandlebars';

export async function renderTemplate(templateId, data) {
	const LocalHandlebars = ClayHandlebars();

	LocalHandlebars.registerHelper('upper', function (str) {
		return lodash.toUpper(str);
	});

	LocalHandlebars.registerHelper('formatDate', function (str, format) {
		return DateTime.fromISO(str).toFormat(format);
	});

	if (/.+\.(hbs|html)$/.test(templateId) === true) {
		const basePath = templatePath();
		const templateFullPath = path.join(basePath, templateId);
		logger.debug({ templateId, basePath, templateFullPath }, 'Loading template file');
		try {
			const templateContent = await readFile(templateFullPath, 'utf-8');
			const template = LocalHandlebars.compile(templateContent);
			return template(data);
		} catch (error) {
			if (error.code === 'ENOENT') {
				logger.error({ templateId, basePath, templateFullPath, cwd: process.cwd(), nodeEnv: process.env.NODE_ENV }, `Template file not found: ${templateId}`);
				throw new Error(`Template ${templateId} not found`);
			}
			throw error;
		}
	}

	const templateCollection = MetaObject.Collections['Template'];

	const templateRecord = await templateCollection.findOne({ _id: templateId });

	if (templateRecord.helpers != null) {
		Object.entries(templateRecord.helpers).forEach(([name, fnCode]) => {
			const contextData = {
				fn: null,
				_: lodash,
				console,
			};

			const sandbox = createContext(contextData);

			const getFnBody = () => {
				if (typeof fnCode === 'string') {
					return `fn = (function(_, console) { return function() {${fnCode}} })(_, console);`;
				} else if (Array.isArray(fnCode)) {
					const [params, body] = fnCode;
					return `fn = (function(_, console) { return function(${params}) {${body}} })(_, console);`;
				} else {
					logger.error(`Invalid helper function code: ${fnCode}`);
					return 'fn = function() {};';
				}
			};

			const scriptToRun = getFnBody();
			runInContext(scriptToRun, sandbox);

			const fn = sandbox.fn;

			// console.dir({name, scriptToRun, fn}, {depth: null})

			LocalHandlebars.registerHelper(name, fn);
		});
	}

	const template = LocalHandlebars.compile(templateRecord.value);

	return template(data);
}
