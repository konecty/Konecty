function isWebTarget(caller) {
	return Boolean(caller && caller.target === 'web');
}

function isWebpack(caller) {
	return Boolean(caller && caller.name === 'babel-loader');
}

module.exports = api => {
	const web = api.caller(isWebTarget);
	const webpack = api.caller(isWebpack);
	return {
		presets: [
			require.resolve('@babel/preset-react'),
			[
				require.resolve('@babel/preset-env'),
				{
					useBuiltIns: web ? 'entry' : undefined,
					corejs: web ? 'core-js@3' : false,
					targets: !web ? { node: 'current' } : undefined,
					modules: webpack ? false : 'commonjs',
				},
			],
		],
		plugins: [
			[
				require.resolve('babel-plugin-module-resolver'),
				{
					root: ['./src'],
					alias: {
						home: './src/routes/home',
						about: './src/routes/about',
					},
				},
			],
			require.resolve('@babel/plugin-transform-runtime'),
			require.resolve('@loadable/babel-plugin'),
		],
	};
};
