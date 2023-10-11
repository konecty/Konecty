module.exports = {
	env: {
		node: true,
		es2021: true,
	},
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	rules: {
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'no-case-declarations': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
	},
	settings: {
		'import/resolver': {
			typescript: {},
		},
	},
};
