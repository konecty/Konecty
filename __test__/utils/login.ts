type typeoffakeHashes = 'admin-test' | 'user-test';

export const login = (user: typeoffakeHashes): string => {
	const fakeHashes = {
		'admin-test': 'hash/admin/test=',
		'user-test': 'hash/user/test=',
		'user-test-2': 'hash/user/2/test=',
	};

	return fakeHashes[user] || 'hash/admin/test=';
};
