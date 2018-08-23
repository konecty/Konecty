/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.ListMeta.events({
	'click .lookup-item'(e, controller) {
		const processingText = 'Processing...';

		const target = $(e.currentTarget);
		const parent = target.closest('li');

		const html = parent.html();

		if (html === processingText) {
			return;
		}

		const documentName = target.data('document');
		const fromDocument = target.data('from-document');
		const fromField = target.data('from-field');

		parent.html(processingText);

		const config = {
			documentName,
			fromDocument,
			fromField
		};

		return Meteor.call('processLookup', config, result => parent.html(html));
	},

	'click .relation-item'(e, controller) {
		const processingText = 'Processing...';

		const target = $(e.currentTarget);
		const parent = target.closest('li');

		const html = parent.html();

		if (html === processingText) {
			return;
		}

		const documentName = target.data('document');
		const fromDocument = target.data('from-document');

		parent.html(processingText);

		const config = {
			documentName,
			fromDocument
		};

		return Meteor.call('processRelation', config, result => parent.html(html));
	}
});
