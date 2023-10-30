export default {
	clearMocks: true,
	collectCoverage: false,
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',

	globalSetup: '<rootDir>/__test__/globalSetup.ts',
	// globalTeardown: '<rootDir>/__test__/globalTeardown.ts',
	// setupFilesAfterEnv: ['<rootDir>/__test__/setupFilesAfterEnv.ts'],

	testEnvironment: 'jest-environment-node',

	transform: {
		'^.+\\.tsx?$': '@swc/jest',
		'^.+\\.(js|jsx)$': 'babel-jest',
	},

	verbose: true,

	watchPathIgnorePatterns: ['globalConfig'],
	testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/build/'],
};
