import { Models } from 'metadata';
import Handlebars from 'handlebars';

// TODO: Test legacy templates
export default function renderTemplate(templateID, data) {
	const templateRecord = Models.Template.findOne(templateID);

	if (templateRecord == null) {
		console.error(`Template ${templateID} not found`);
		return null;
	}
	const hbsInstance = Handlebars.create();

	if (templateRecord.helpers != null) {
		Object.keys(templateRecord.helpers).forEach(k => {
			hbsInstance.registerHelper(k, new Function(`return (${templateRecord.helpers[k]})`)());
		});
	}

	const template = hbsInstance.compile(templateRecord.value);

	return template(data);
}
