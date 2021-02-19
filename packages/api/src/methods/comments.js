import isString from 'lodash/isString';

import { registerMethod } from '@konecty/utils/methods';
import { Models } from '@konecty/metadata';

const init = () => {
	/* Get a list of comments of one record
	@param authTokenId
	@param document
	@param dataId
  */
	registerMethod('comments:find', 'withUser', 'withAccessForDocument', async function (request) {
		// Get comment model
		const modelComment = Models[`${request.document}.Comment`];
		if (!modelComment) {
			return new Error(`[internal-error] Document ${field.document}.Comment does not exists`);
		}

		// Validate param dataId
		if (!isString(request.dataId)) {
			return new Error('[internal-error] Param dataId must be a valid string id');
		}

		const data = await modelComment.find({ dataId: request.dataId }, { sort: { _createdAt: 1 } }).toArray();

		return { success: true, data };
	});

	/* Create a new commento for given record
	@param authTokenId
	@param document
	@param dataId
	@param text
  */
	registerMethod('comments:create', 'withUser', 'withAccessForDocument', async function (request) {
		// Validate text field
		if (!isString(request.text) || request.text.length === 0) {
			return new Error('[internal-error] Comment must be a string with one or more characters');
		}

		// Get data model
		const model = Models[request.document];
		if (!model) {
			return new Error(`[internal-error] Document ${request.document} does not exists`);
		}

		// Get comment model
		const modelComment = Models[`${request.document}.Comment`];
		if (!modelComment) {
			return new Error(`[internal-error] Document ${request.document}.Comment does not exists`);
		}

		// Validate param dataId
		if (!isString(request.dataId)) {
			return new Error('[internal-error] Param dataId must be a valid string id');
		}

		// If no record exists with passed ID return error
		const record = await model.findOne(request.dataId);
		if (!record) {
			return new Error(`[internal-error] Record not found using id ${request.dataId}`);
		}

		const data = {
			dataId: request.dataId,
			_createdAt: new Date(),
			_createdBy: {
				_id: this.user._id,
				group: this.user.group,
				name: this.user.name,
			},
			text: request.text,
		};

		try {
			await modelComment.insert(data);
		} catch (e) {
			console.log(e);
			this.notifyError('Comment - Insert Error', e);
		}

		return { success: true, data: [data] };
	});
};
export { init };
