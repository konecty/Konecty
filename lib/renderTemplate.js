import { SSR } from 'meteor/meteorhacks:ssr';
import { Templates } from '/imports/konsistent/mailConsumer';

import { Models } from '/imports/model/MetaObject';

export const renderTemplate = function (templateId, data) {
	const record = Models['Template'].findOne(templateId);

	Templates[templateId] = {
		template: SSR.compileTemplate(templateId, record.value),
		subject: record.subject,
	};

	for (let name in record.helpers) {
		let fn = record.helpers[name];
		const helper = {};
		fn = [].concat(fn);
		helper[name] = Function.apply(null, fn);
		Templates[templateId].helpers(helper);
	}

	return SSR.render(templateId, data);
};
