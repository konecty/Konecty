module.exports = {
	env: {
		node: true,
		es2021: true,
		jest: true,
		'jest/globals': true,
	},
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint', 'jest', 'prettier'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'prettier'],
	rules: {
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'no-case-declarations': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
	},
	settings: {
		'import/parsers': {
			'@typescript-eslint/parser': ['.ts', '.tsx'],
		},
		'import/resolver': {
			typescript: {
				alwaysTryTypes: true,
			},
		},
	},
	root: true,
};
