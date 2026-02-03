import { describe, it, expect, mock } from 'bun:test';
import { User } from '@imports/model/User';

// Mock getUser and MetaObject before loading the module under test (Bun uses mock.module)
const mockGetUser = mock();
mock.module('@imports/auth/getUser', () => ({
	getUser: mockGetUser,
}));

const mockNamespace = {
	ns: 'namespace',
	logoURL: 'logoURL',
	siteURL: 'siteURL',
	title: 'title',
	watermark: 'watermark',
	addressComplementValidation: 'addressComplementValidation',
};
mock.module('@imports/model/MetaObject', () => ({
	MetaObject: { Namespace: mockNamespace },
}));

// Dynamic import so userInfo loads after mocks
const { userInfo } = await import('.');
const { MetaObject } = await import('@imports/model/MetaObject');

describe('userInfo', () => {
	it('should return user info', async () => {
		const user: User = {
			_id: '123',
			access: {
				'123': ['read'],
			},
			admin: true,
			emails: [{ address: 'email' }],
			group: {
				_id: '123',
				name: 'name',
			},
			locale: 'locale',
			username: 'username',
			active: true,
			services: {
				resume: {
					loginTokens: [
						{
							hashedToken: 'hashed',
							when: new Date(),
						},
					],
				},
			},
		};

		mockGetUser.mockResolvedValueOnce(user);

		const result = await userInfo('123');

		expect(result).toEqual({
			logged: true,
			user: {
				_id: user._id,
				access: user.access,
				admin: user.admin,
				email: user.emails[0].address,
				group: user.group,
				locale: user.locale,
				login: user.username,
				name: user.name,
				namespace: {
					_id: MetaObject.Namespace.ns,
					logoURL: MetaObject.Namespace.logoURL,
					siteURL: MetaObject.Namespace.siteURL,
					title: MetaObject.Namespace.title,
					watermark: MetaObject.Namespace.watermark,
					addressComplementValidation: MetaObject.Namespace.addressComplementValidation,
				},
				role: user.role,
			},
		});
	});

	it('should return logged false', async () => {
		mockGetUser.mockResolvedValueOnce(null);

		const result = await userInfo('123');

		expect(result).toEqual({
			logged: false,
			user: null,
		});

		expect(mockGetUser).toHaveBeenCalledWith('123');
	});
});
