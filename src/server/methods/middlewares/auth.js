import isDate from 'lodash/isDate';
import isObject from 'lodash/isObject';
import get from 'lodash/get';
import toLower from 'lodash/toLower';
import size from 'lodash/size';
import defer from 'lodash/defer';

import { registerMiddleware } from 'utils/methods';
import { hashLoginToken } from 'utils/password';
import { getAccessFor } from 'utils/access';

import { Meta, Models } from 'metadata';

const init = () => {
	// Middleware to get user and populate into request
	registerMiddleware('withUser', async function (request) {
		if (this.user) {
			return;
		}

		if (size(request.authTokenId) > 0) {
			this.hashedToken = request.authTokenId;

			if (size(get(request, 'authTokenId')) === 24) {
				this.hashedToken = toLower(request.authTokenId);
			}

			if (size(request.authTokenId) === 43) {
				this.hashedToken = hashLoginToken(request.authTokenId);
			}

			this.user = await Models.User.findOne({ 'services.resume.loginTokens.hashedToken': this.hashedToken });
			// If no user was found return error
			if (!this.user) {
				console.log(`[withUser] User not found using token ${this.hashedToken}`);
				return 401;
			}

			this.userId = this.user._id;
		} else if (this.userId) {
			this.user = await Models.User.findOne({ _id: this.userId });
		} else {
			console.log('[withUser] No authTokenId or user was passed');
			return 401;
		}

		if (this.user.active !== true) {
			console.log(`[withUser] User inactive for token ${this.hashedToken}`);
			return 401;
		}

		// Set lastLogin if no lastLogin or is older than 1h
		if (!request || request.dontSetLastLogin !== true) {
			if (!this.user.lastLogin || !isDate(this.user.lastLogin) || Date.now() - this.user.lastLogin.getTime() > 3600000) {
				defer(async () => {
					await Models.User.updateOne({ _id: this.user._id }, { $set: { lastLogin: new Date() } });
				});
			}
		}
	});

	// Middleware to get access from document as parameter 'document'
	registerMiddleware('withAccessForDocument', async function (request) {
		if (this.access) {
			return;
		}

		const documentName = request.document;

		// If no param was found with document name return 401 (Unauthorized)
		if (!documentName) {
			console.log('[withAccessForDocument] No documentName was passaed');
			return 401;
		}

		// Find access
		const access = getAccessFor(documentName, this.user);

		// If return is false no access was found then return 401 (Unauthorized)
		if (access === false) {
			console.log('[withAccessForDocument] User have no access');
			return 401;
		}

		// If return is object then set access into requrest
		if (isObject(access)) {
			this.access = access;
			return;
		}

		// Return 401 (Unauthorized) if no access was found
		console.log('[withAccessForDocument] No access found');
		return 401;
	});

	// Middleware to get meta from document as parameter 'document'
	registerMiddleware('withMetaForDocument', async function (request) {
		const documentName = request.document;

		// If no param was found with document name return 401 (Unauthorized)
		if (!documentName) {
			return new Error('[internal-error] [withMetaForDocument] No documentName was passaed', { request });
		}

		// Try to get metadata
		const meta = Meta[request.document];
		if (!meta) {
			return new Error(`[internal-error] [withMetaForDocument] Document [${request.document}] does not exists`, { request });
		}

		this.meta = meta;
	});

	// Middleware to get model from document as parameter 'document'
	registerMiddleware('withModelForDocument', async function (request) {
		const documentName = request.document;

		// If no param was found with document name return 401 (Unauthorized)
		if (!documentName) {
			return new Error('[internal-error] [withModelForDocument] No documentName was passaed', { request });
		}

		// Try to get model of document
		const model = Models[request.document];
		if (!model) {
			return new Error(`[internal-error] [withModelForDocument] Document [${request.document}] does not exists`, { request });
		}

		this.model = model;
	});
};

export { init };
