// Bundles for the Unity editor extension, each one readable script run by Jint inside Unity:
// - sim:  src/unityHost/host.ts (the preview's simulator), global `JcreateppHost`
// - core: src/unityHost/core.ts (headless Blockly + converter + codegen + parts), global `JcreateppCore`
// Written to unity/Jcreatepp/Editor/ by scripts/unity-sim.js (npm run unity:sim).
const path = require('path');
const webpack = require('webpack');

function bundle(name, entry, library, extraPlugins = []) {
  return {
    name,
    mode: 'none', // no minification: the bundle stays readable (and keeps the libraries' @license comments)
    target: ['es2017'], // Jint 4 supports this (classes, Proxy, Set, arrow functions)
    entry,
    output: {
      path: path.resolve(__dirname, '.unity-sim-build', name),
      filename: `jcreatepp-${name}.js`,
      library: { name: library, type: 'var' },
      iife: true,
      // Single file, no chunk loading (Jint has no document / require).
      chunkFormat: 'array-push',
      chunkLoading: false,
      clean: true,
    },
    optimization: { splitChunks: false, runtimeChunk: false },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          // Type checking is done by `npx tsc --noEmit`; here only transpile, without declaration files.
          options: { transpileOnly: true, compilerOptions: { declaration: false, declarationMap: false, target: 'ES2017', module: 'ES2020' } },
        },
      ],
    },
    resolve: { extensions: ['.ts', '.js'] },
    plugins: extraPlugins,
  };
}

module.exports = [
  bundle('sim', './src/unityHost/host.ts', 'JcreateppHost'),
  bundle('core', './src/unityHost/core.ts', 'JcreateppCore', [
    new webpack.DefinePlugin({
      __JCREATEPP_VERSION__: JSON.stringify(require('./package.json').version),
      __BLOCKLY_VERSION__: JSON.stringify(JSON.parse(require('fs').readFileSync(path.join(__dirname, 'node_modules/blockly/package.json'), 'utf8')).version),
    }),
  ]),
];
