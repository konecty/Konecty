import { createContext, runInContext } from 'node:vm';
import lodash from 'lodash';

import { Collections } from '/imports/model/MetaObject';
import { logger } from '/imports/utils/logger';
import path from 'node:path';
import { templatePath } from '/imports/utils/templatesPath';
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

	if (/.+\.hbs$/.test(templateId) === true) {
		const templateFullPath = path.join(templatePath(), templateId);
		const templateContent = await readFile(templateFullPath, 'utf-8');
		const template = LocalHandlebars.compile(templateContent);
		return template(data);
	}

	const templateCollection = Collections['Template'];

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
