import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	preset: 'ts-jest/presets/js-with-babel',
	clearMocks: true,
	collectCoverage: false,
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',
	globalSetup: '<rootDir>/__test__/globalSetup.ts',
	globalTeardown: '<rootDir>/__test__/globalTeardown.ts',

	testEnvironment: 'jest-environment-node',

	verbose: true,

	watchPathIgnorePatterns: ['globalConfig'],
	testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/build/'],
};

export default jestConfig;
