import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

import { Models } from '/imports/model/MetaObject';
import { logger } from '/imports/utils/logger';

export function getFirstUser() {
	return Meteor.users.findOne({ username: process.env.KONDATA_ADMIN_USERNAME || 'admin' }, { fields: { _id: 1, group: 1 } });
}

export function registerFirstGroup() {
	const admin = getFirstUser();

	if (!admin || typeof admin.group !== 'undefined' || !Models['Group']) {
		return;
	}

	const group = Models['Group'].findOne({ name: 'SYSTEM' });

	if (!group) {
		logger.info('[kondata] Create first group');

		const newGroup = {
			_createdAt: new Date(),
			_createdBy: {
				_id: admin._id,
			},
			_updatedAt: new Date(),
			_updatedBy: admin._id,
			_user: [
				{
					_id: admin._id,
					active: true,
				},
			],
			active: true,
			name: 'SYSTEM',
		};

		const groupId = Models['Group'].insert(newGroup);

		Meteor.users.update(admin._id, {
			$set: {
				group: {
					_id: groupId,
				},
			},
		});
	}
}

export function registerFirstUser() {
	let admin = getFirstUser();

	if (!admin) {
		logger.info('[kondata] Create first user');

		const adminId = Accounts.createUser({
			username: process.env.KONDATA_ADMIN_USERNAME || 'admin',
			email: process.env.KONDATA_ADMIN_EMAIL || 'contact@konecty.com',
			password: process.env.KONDATA_ADMIN_PASSWORD || 'admin',
		});

		const adminName = process.env.KONDATA_ADMIN_NAME || 'Administrator';

		const newAdmin = {
			_createdAt: new Date(),
			_createdBy: {
				_id: adminId,
				name: adminName,
			},
			_updatedAt: new Date(),
			_updatedBy: {
				_id: adminId,
				name: adminName,
				ts: new Date(),
			},
			_user: [
				{
					_id: adminId,
					name: adminName,
					active: true,
				},
			],
			access: {
				defaults: ['Full'],
			},
			active: true,
			admin: true,
			locale: process.env.KONDATA_ADMIN_LOCALE || 'en',
			name: adminName,
		};

		Meteor.users.update(adminId, {
			$set: newAdmin,
		});
	}
}
