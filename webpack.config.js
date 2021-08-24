const HtmlWebPackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const LoadablePlugin = require('@loadable/webpack-plugin');

module.exports = (_, argv) => ({
	entry: './src/ui/index.js',
	output: {
		filename: 'index.js',
		path: path.resolve(process.cwd(), 'dist', 'public', 'app'),
		publicPath: '/',
	},

	resolve: {
		extensions: ['.jsx', '.js', '.json'],
	},

	optimization:
		argv.mode === 'production'
			? {
					minimize: true,
					minimizer: [new TerserPlugin()],
			  }
			: undefined,

	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						caller: { target: 'web' },
					},
				},
			},
		],
	},

	plugins: [
		new LoadablePlugin(),
		new HtmlWebPackPlugin({
			template: './src/ui/index.html',
		}),
	],
});
