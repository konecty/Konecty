import { createContext, runInContext } from 'node:vm';
import Handlebars from 'handlebars';
import lodash from 'lodash';

import { Collections } from '/imports/model/MetaObject';
import { logger } from '/imports/utils/logger';

export async function renderTemplate(templateId, data) {
	const templateCollection = Collections['Template'];

	const templateRecord = await templateCollection.findOne({ _id: templateId });

	const LocalHandlebars = Handlebars.create();

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
					const [ params, body ] = fnCode;
					return `fn = (function(_, console) { return function(${params}) {${body}} })(_, console);`
				} else {
					logger.error(`Invalid helper function code: ${fnCode}`);
					return 'fn = function() {};';
				}
			}

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
