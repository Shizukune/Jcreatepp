// Bundles src/unityHost/host.ts (and the simulator it uses) for the Unity editor preview.
// One readable script defining the global `JcreateppHost`, run by Jint inside Unity.
// Written to unity/Jcreatepp/Editor/Preview/Sim/ by scripts/unity-sim.js (npm run unity:sim).
const path = require('path');

module.exports = {
  mode: 'none', // no minification: the bundle stays readable
  target: ['es2017'], // Jint 4 supports this (classes, Proxy, Set, arrow functions)
  entry: './src/unityHost/host.ts',
  output: {
    path: path.resolve(__dirname, '.unity-sim-build'),
    filename: 'jcreatepp-sim.js',
    library: { name: 'JcreateppHost', type: 'var' },
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
};
