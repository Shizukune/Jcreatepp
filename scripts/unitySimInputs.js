// The source files the Unity preview bundle is built from, and a hash of them.
// Used by scripts/unity-sim.js (writes the hash into the bundle) and test/unityHost.test.ts
// (fails when the committed bundle is older than the sources). The import graph is read from the
// sources themselves, so a new import is never forgotten.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENTRY = 'src/unityHost/host.ts';
const CONFIG = 'webpack.unity.config.js';

function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base + '.ts', path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`cannot resolve ${spec} from ${fromFile}`);
}

/** Repository-relative paths (forward slashes) of every source file reachable from the entry. */
function inputFiles(root) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    const re = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text))) visit(resolveImport(file, m[1] || m[2]));
  };
  visit(path.join(root, ENTRY));
  const files = [...seen].map((f) => path.relative(root, f).split(path.sep).join('/'));
  files.push(CONFIG);
  return files.sort();
}

function inputsHash(root) {
  const hash = crypto.createHash('sha256');
  for (const file of inputFiles(root)) {
    hash.update(file + '\n');
    hash.update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\n');
  }
  return hash.digest('hex');
}

module.exports = { inputFiles, inputsHash };
