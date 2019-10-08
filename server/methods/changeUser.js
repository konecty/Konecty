import { map } from 'lodash';

const validateRequest = function(request, access) {
	// Verify if user have permission to update record
	if (access.isUpdatable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update this record`);
	}

	if (access.changeUser !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to change users`);
	}

	if (!_.isArray(request.users) || request.users.length === 0) {
		return new Meteor.Error(
			'internal-error',
			`[${request.document}] You need to provide the property [users] as an array with at least one item`,
			{ request }
		);
	}

	for (let user of request.users) {
		if (!_.isObject(user) || !_.isString(user._id)) {
			return new Meteor.Error('internal-error', `[${request.document}] Each user must be and Object with an [_id] as String`, {
				request
			});
		}
	}

	if (!_.isArray(request.ids) || request.ids.length === 0) {
		return new Meteor.Error(
			'internal-error',
			`[${request.document}] You need to provide the property [ids] as an array with at least one item`,
			{ request }
		);
	}

	for (let id of request.ids) {
		if (_.isString(id) !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] Each id must be String`, { request });
		}
	}
};

/* Add users
	@param authTokenId
	@param document
	@param ids
	@param users
*/
Meteor.registerMethod(
	'changeUser:add',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.addUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to add users`);
		}

		const validateRequestResult = validateRequest(request, this.access);
		if (validateRequestResult instanceof Error) {
			return validateRequestResult;
		}

		const resultOfValidation = metaUtils.validateAndProcessValueFor(
			this.meta,
			'_user',
			request.users,
			'update',
			this.model,
			{},
			{},
			request.ids
		);
		if (resultOfValidation instanceof Error) {
			return resultOfValidation;
		}

		for (let user of request.users) {
			const now = new Date();

			const query = {
				_id: {
					$in: request.ids
				},
				'_user._id': {
					$ne: user._id
				}
			};

			const update = {
				$push: {
					_user: {
						$each: [utils.processDate(user)],
						$position: 0
					}
				},
				$set: {
					_updatedAt: now,
					_updatedBy: {
						_id: this.user._id,
						name: this.user.name,
						group: this.user.group,
						ts: now
					}
				}
			};

			const options = { multi: true };
			try {
				this.model.update(query, update, options);
			} catch (e) {
				return e;
			}
		}

		return { success: true };
	}
);

/* Remove users
	@param authTokenId
	@param document
	@param ids
	@param users
*/
Meteor.registerMethod(
	'changeUser:remove',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.removeUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to remove users`);
		}

		const validateRequestResult = validateRequest(request, this.access);
		if (validateRequestResult instanceof Error) {
			return validateRequestResult;
		}

		const userIds = request.users.map(user => user._id);

		const now = new Date();

		const query = {
			_id: {
				$in: request.ids
			},
			'_user._id': {
				$in: userIds
			}
		};

		const update = {
			$pull: {
				_user: {
					_id: {
						$in: userIds
					}
				}
			},
			$set: {
				_updatedAt: now,
				_updatedBy: {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: now
				}
			}
		};

		const options = { multi: true };
		try {
			this.model.update(query, update, options);
		} catch (e) {
			return e;
		}

		return { success: true };
	}
);

/* Define users
	@param authTokenId
	@param document
	@param ids
	@param users
*/
Meteor.registerMethod(
	'changeUser:define',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.defineUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to define users`);
		}

		const validateRequestResult = validateRequest(request, this.access);
		if (validateRequestResult instanceof Error) {
			return validateRequestResult;
		}

		const resultOfValidation = metaUtils.validateAndProcessValueFor(
			this.meta,
			'_user',
			request.users,
			'update',
			this.model,
			{},
			{},
			request.ids
		);
		if (resultOfValidation instanceof Error) {
			return resultOfValidation;
		}

		const now = new Date();

		const query = {
			_id: {
				$in: request.ids
			}
		};

		const update = {
			$set: {
				_user: map(request.users, utils.processDate),
				_updatedAt: now,
				_updatedBy: {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: now
				}
			}
		};

		const options = { multi: true };
		try {
			this.model.update(query, update, options);
		} catch (e) {
			return e;
		}

		return { success: true };
	}
);

/* Replace users
	@param authTokenId
	@param document
	@param ids
	@param users
*/
Meteor.registerMethod(
	'changeUser:replace',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		let e;
		if (this.access.replaceUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to replace users`);
		}

		const { access } = this;

		// Verify if user have permission to update record
		if (access.isUpdatable !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update this record`);
		}

		if (access.changeUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to change users`);
		}

		if (!_.isObject(request.from) || !_.isString(request.from._id)) {
			return new Meteor.Error(
				'internal-error',
				`[${request.document}] You need to provide the property [from] as an Object with an [_id] as String`,
				{ request }
			);
		}

		if (!_.isObject(request.to) || !_.isString(request.to._id)) {
			return new Meteor.Error(
				'internal-error',
				`[${request.document}] You need to provide the property [to] as an Object with an [_id] as String`,
				{ request }
			);
		}

		if (!_.isArray(request.ids) || request.ids.length === 0) {
			return new Meteor.Error(
				'internal-error',
				`[${request.document}] You need to provide the property [ids] as an array with at least one item`,
				{ request }
			);
		}

		for (let id of request.ids) {
			if (_.isString(id) !== true) {
				return new Meteor.Error('internal-error', `[${request.document}] Each id must be String`, { request });
			}
		}

		const resultOfValidation = metaUtils.validateAndProcessValueFor(
			this.meta,
			'_user',
			[request.to],
			'update',
			this.model,
			{},
			{},
			request.ids
		);
		if (resultOfValidation instanceof Error) {
			return resultOfValidation;
		}

		let now = new Date();

		const query = {
			_id: {
				$in: request.ids
			},
			'_user._id': request.from._id
		};

		let update = {
			$push: {
				_user: {
					$each: [utils.processDate(request.to)],
					$position: 0
				}
			},
			$set: {
				_updatedAt: now,
				_updatedBy: {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: now
				}
			}
		};

		const options = { multi: true };
		try {
			this.model.update(query, update, options);
		} catch (error) {
			e = error;
			return e;
		}

		now = new Date();

		update = {
			$pull: {
				_user: {
					_id: request.from._id
				}
			},
			$set: {
				_updatedAt: now,
				_updatedBy: {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: now
				}
			}
		};

		try {
			this.model.update(query, update, options);
		} catch (error1) {
			e = error1;
			return e;
		}

		return { success: true };
	}
);

/* Count inactive users
	@param authTokenId
	@param document
	@param ids
*/
Meteor.registerMethod(
	'changeUser:countInactive',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.removeInactiveUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to remove inactive users`);
		}

		// Verify if user have permission to update records
		if (this.access.isUpdatable !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update this record`);
		}

		if (this.access.changeUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to change users`);
		}

		for (let id of request.ids) {
			if (_.isString(id) !== true) {
				return new Meteor.Error('internal-error', `[${request.document}] Each id must be String`, { request });
			}
		}

		const query = {
			_id: {
				$in: request.ids
			},
			'_user.active': false
		};

		try {
			const count = this.model.find(query).count();
			return {
				success: true,
				count
			};
		} catch (e) {
			return e;
		}
	}
);

/* Remove inactive users
	@param authTokenId
	@param document
	@param ids
*/
Meteor.registerMethod(
	'changeUser:removeInactive',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.removeInactiveUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to remove inactive users`);
		}

		// Verify if user have permission to update records
		if (this.access.isUpdatable !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update this record`);
		}

		if (this.access.changeUser !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to change users`);
		}

		for (let id of request.ids) {
			if (_.isString(id) !== true) {
				return new Meteor.Error('internal-error', `[${request.document}] Each id must be String`, { request });
			}
		}

		const now = new Date();

		const query = {
			_id: {
				$in: request.ids
			},
			'_user.active': false
		};

		const update = {
			$pull: {
				_user: {
					active: false
				}
			},
			$set: {
				_updatedAt: now,
				_updatedBy: {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: now
				}
			}
		};

		const options = { multi: true };
		try {
			this.model.update(query, update, options);
		} catch (e) {
			return e;
		}

		return { success: true };
	}
);

/* Set queue and user
	@param authTokenId
	@param document
	@param ids
	@param queue
*/
Meteor.registerMethod(
	'changeUser:setQueue',
	'withUser',
	'withAccessForDocument',
	'withMetaForDocument',
	'withModelForDocument',
	function(request) {
		if (this.access.defineUserWithQueue !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to define users using queue`);
		}

		const validateRequestResult = validateRequest(request, this.access);
		if (validateRequestResult instanceof Error) {
			return validateRequestResult;
		}

		const queue = metaUtils.validateAndProcessValueFor(this.meta, 'queue', request.queue, 'update', this.model, {}, {}, id);
		if (queue instanceof Error) {
			return queue;
		}

		const now = new Date();

		for (var id of request.ids) {
			const userQueue = metaUtils.getNextUserFromQueue(request.queue._id, this.user);
			const user = metaUtils.validateAndProcessValueFor(this.meta, '_user', userQueue.user, 'update', this.model, {}, {}, id);
			if (user instanceof Error) {
				return user;
			}

			const query = { _id: id };

			const update = {
				$set: {
					queue,
					_user: user,
					_updatedAt: now,
					_updatedBy: {
						_id: this.user._id,
						name: this.user.name,
						group: this.user.group,
						ts: now
					}
				}
			};

			try {
				this.model.update(query, update);
			} catch (e) {
				return e;
			}
		}

		return { success: true };
	}
);
