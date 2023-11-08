import type { JestConfigWithTsJest } from 'ts-jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';
const jestConfig: JestConfigWithTsJest = {
	preset: 'ts-jest/presets/js-with-babel',
	clearMocks: true,
	collectCoverage: false,
	collectCoverageFrom: [
		'src/**/*.{js,ts}',
		'!<rootDir>/src/**/*.d.{js,jsx,ts,tsx}',
		'!<rootDir>/src/**/*mock*.{js,jsx,ts,tsx}',
		'!<rootDir>/**/stories.{js,jsx,ts,tsx}',
		'!<rootDir>/node_modules/',
	],
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',
	globalSetup: '<rootDir>/__test__/globalSetup.ts',
	globalTeardown: '<rootDir>/__test__/globalTeardown.ts',

	testEnvironment: 'jest-environment-node',

	verbose: true,
	roots: ['<rootDir>'],
	modulePaths: [compilerOptions.baseUrl],
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src' }),
	watchPathIgnorePatterns: ['globalConfig'],
	testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/build/'],
};

export default jestConfig;
