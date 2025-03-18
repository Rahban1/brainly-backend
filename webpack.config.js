const path = require('path');

module.exports = {
  entry: './src/worker.js',
  target: 'webworker',
  output: {
    filename: 'worker.js',
    path: path.join(__dirname, 'dist'),
  },
  mode: 'production',
  optimization: {
    usedExports: true,
  },
  performance: {
    hints: false,
  },
};