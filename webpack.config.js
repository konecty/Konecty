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

	devServer: {
		static: {
			directory: path.join(__dirname, 'src/ui/static'),
		},
		port: parseInt(process.env.PORT ?? 3000, 10) + 1,
		hot: true,
		historyApiFallback: true,
		proxy: {
			'/api': `http://localhost:${process.env.PORT ?? 3000}`,
		},
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
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/i,
				type: 'asset/resource',
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
