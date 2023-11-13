type typeoffakeHashes = 'admin-test' | 'user-test';

export const login = (user: typeoffakeHashes): string => {
	const fakeHashes = {
		'admin-test': '__user_is_admin__',
		'user-test': '__user_is_broker__',
		'user-test-2': '__user_is_default__',
	};

	return fakeHashes[user] || '__user_is_admin__';
};
