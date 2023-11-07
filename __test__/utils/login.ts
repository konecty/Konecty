type typeoffakeHashes = 'admin-test';

export const login = (user: typeoffakeHashes): string => {
	const fakeHashes = {
		'admin-test': 'v5+zj+CGtYlPHYLYMR3elJn5v/kAl3naUI+N7XwEgpM=',
	};

	return fakeHashes[user] || 'v5+zj+CGtYlPHYLYMR3elJn5v/kAl3naUI+N7XwEgpM=';
};
