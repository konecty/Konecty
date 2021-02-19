const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (_, { mode }) => ({
    entry: {
        index: './src/index.js',
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].js',
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    devtool: mode === 'development' ? 'source-map' : undefined,
    optimization: {
        minimize: !(mode === 'development')
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
                    loader: "babel-loader",
                    options: {
                        presets: [[
                            "@babel/preset-env",
                            {
                                "targets": {
                                    "node": true
                                }
                            }
                        ]]
                    }
                }
            }
        ]
    }
});
