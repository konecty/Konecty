const path = require('path');
const NodemonPlugin = require('nodemon-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const watchPaths = [path.resolve('./dist'), path.resolve('../database/dist'), path.resolve('../metadata/dist'), path.resolve('../nodered/dist'), path.resolve('../utils/dist')];

module.exports = (_, { mode }) => ({
	entry: './src/index.js',
	output: {
		path: path.resolve('./dist'),
		filename: 'index.js',
	},
	devtool: mode === 'development' ? 'source-map' : undefined,
	optimization: {
		minimize: !(mode === 'development'),
	},
	externalsPresets: { node: true },
	externals: [nodeExternals({ additionalModuleDirs: ['../../node_modules'] })],
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
	plugins: [new NodemonPlugin({ watch: watchPaths, delay: '500' })],
});
