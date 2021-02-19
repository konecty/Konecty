const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (_, { mode }) => ({
	entry: {
		index: './src/index.js',
		methods: './src/methods.js',
		access: './src/access.js',
		errors: './src/errors.js',
		filter: './src/filter.js',
		meta: './src/meta.js',
		lookup: './src/lookup.js',
		password: './src/password.js',
		renderTemplate: './src/renderTemplate.js',
		session: './src/session.js',
		sort: './src/sort.js',
	},
	output: {
		path: path.resolve('./dist'),
		filename: '[name].js',
		libraryTarget: 'umd',
		globalObject: 'this',
	},
	devtool: mode === 'development' ? 'source-map' : undefined,
	optimization: {
		minimize: !(mode === 'development'),
	},
	externalsPresets: { node: true },
	externals: [nodeExternals({ additionalModuleDirs: ['../../node_modules'] })],
	resolve: {
		extensions: ['.js', '.json'],
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				type: 'javascript/auto',
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							[
								'@babel/preset-env',
								{
									targets: {
										node: true,
									},
								},
							],
						],
					},
				},
			},
		],
	},
});
