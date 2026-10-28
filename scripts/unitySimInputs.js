// The source files each Unity bundle is built from, and a hash of them.
// Used by scripts/unity-sim.js (writes the hash into the bundle) and test/unityHost.test.ts /
// test/unityCore.test.ts (fail when a committed bundle is older than its sources). The import graph
// is read from the sources themselves, so a new import is never forgotten.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = 'webpack.unity.config.js';
/** Entry and the extra files that decide its output (the core also depends on Blockly's version). */
const BUNDLES = {
  sim: { entry: 'src/unityHost/host.ts', extra: [] },
  core: { entry: 'src/unityHost/core.ts', extra: ['package-lock.json'] },
};

function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base + '.ts', path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`cannot resolve ${spec} from ${fromFile}`);
}

/** Repository-relative paths (forward slashes) of every source file reachable from the bundle's entry. */
function inputFiles(root, name = 'sim') {
  const { entry, extra } = BUNDLES[name];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    const re = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text))) visit(resolveImport(file, m[1] || m[2]));
  };
  visit(path.join(root, entry));
  const files = [...seen].map((f) => path.relative(root, f).split(path.sep).join('/'));
  files.push(CONFIG, ...extra);
  return files.sort();
}

function inputsHash(root, name = 'sim') {
  const hash = crypto.createHash('sha256');
  for (const file of inputFiles(root, name)) {
    hash.update(file + '\n');
    hash.update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\n');
  }
  return hash.digest('hex');
}

module.exports = { inputFiles, inputsHash };
