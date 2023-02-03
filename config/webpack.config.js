'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = merge(common, {
  entry: {
    background: PATHS.src + '/background.ts',
    popup: PATHS.src + '/popup.ts',
    options: PATHS.src + '/options.ts',
    search: PATHS.src + '/search.ts',
    content: PATHS.src + '/content.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    modules: [
      'src',
      'node_modules'
    ],
    extensions: [
      '.js',
      '.ts'
    ]
  }
});

module.exports = config;
