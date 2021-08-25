import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';

import { registerMiddleware } from 'utils/methods';

const init = () => {
	// Middleware to verify if user have permission to create records
	/* @DEPENDS_ON_ACCESS */
	registerMiddleware('ifAccessIsCreateable', function (request) {
		if (this.access.isCreatable !== true) {
			return new Error(`[internal-error - ${request.document}] You don't have permission to create records`, {
				bugsnag: false,
			});
		}
	});

	// Middleware to verify if user have permission to update records
	/* @DEPENDS_ON_ACCESS */
	registerMiddleware('ifAccessIsUpdatable', function (request) {
		if (this.access.isUpdatable !== true) {
			return new Error(`[internal-error - ${request.document}] You don't have permission to update this record`);
		}
	});

	// Middleware to verify if user have permission to delete records
	/* @DEPENDS_ON_ACCESS */
	registerMiddleware('ifAccessIsDeletable', function (request) {
		if (this.access.isDeletable !== true) {
			return new Error(`[internal-error - ${request.document}] You don't have permission to delete this record`);
		}
	});

	// Middleware to verify if update playload is valid
	/* @DEPENDS_ON_META */
	registerMiddleware('ifUpdateIsValid', function (request) {
		if (!isObject(request.data)) {
			return new Error(`[internal-error - ${request.document}] Invalid payload`);
		}

		if (!isArray(request.data.ids) || request.data.ids.length === 0) {
			return new Error(`[internal-error - ${request.document}] Payload must contain an array of ids with at least one item`);
		}

		if (!isObject(request.data.data) || Object.keys(request.data.data).length === 0) {
			return new Error(`[internal-error - ${request.document}] Payload must contain an object with data to update with at least one item`);
		}

		const { meta } = this;

		for (const item of request.data.ids) {
			if (!isObject(item) || !isString(item._id)) {
				return new Error(`[internal-error - ${request.document}] Each id must contain an valid _id`);
			}

			if (meta.ignoreUpdatedAt !== true) {
				if (!isObject(item) || !isObject(item._updatedAt) || !isString(item._updatedAt.$date)) {
					return new Error(`[internal-error - ${request.document}] Each id must contain an date field named _updatedAt`);
				}
			}
		}
	});

	// Middleware to verify if create playload is valid
	registerMiddleware('ifCreateIsValid', request => {
		if (!isObject(request.data)) {
			return new Error('Iinternal-error - nvalid payload');
		}

		if (!isObject(request.data) || Object.keys(request.data).length === 0) {
			return new Error(`[internal-error - ${request.document}] Payload must contain an object with at least one item`);
		}
	});
};

export { init };
