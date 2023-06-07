import { SSR } from 'meteor/meteorhacks:ssr';
import { Template } from '/imports/konsistent/mailConsumer';

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
		Template[templateId].helpers(helper);
	}

	return SSR.render(templateId, data);
};
