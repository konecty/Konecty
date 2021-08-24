/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
const NodemonPlugin = require('nodemon-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const LoadablePlugin = require('@loadable/webpack-plugin');

module.exports = {
	entry: {
		server: './src/api/index.js',
	},
	target: 'node',
	output: {
		path: path.resolve(process.cwd(), 'dist'),
		filename: '[name].js',
		libraryTarget: 'commonjs2',
	},
	externals: [
		nodeExternals({
			modulesDir: path.resolve(__dirname, './node_modules'),
		}),
	],
	resolve: {
		extensions: ['.jsx', '.js', '.json'],
	},

	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						caller: { target: 'node' },
					},
				},
			},
		],
	},

	plugins: [
		new LoadablePlugin(),
		new NodemonPlugin({
			script: path.resolve(process.cwd(), 'dist', 'server.js'),
			watch: [path.resolve('./dist')],
			ignore: ['*.js.map'],
			ext: 'js,json',
			delay: '1000',
			verbose: true,
			env: {
				NODE_ENV: 'development',
			},
		}),
	],
};
