// Writes what the Unity preview bundle does with each real-device kit script, run in Node (vm, no
// browser globals): one line per script — name, position x y z, rotation x y z w, time.
// SimHostCheck.cs runs the same operations in Jint and compares.
// Usage: node unity/check/expected.js <out.txt>
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const bundle = fs.readFileSync(path.join(root, 'unity/Jcreatepp/Editor/Preview/Sim/jcreatepp-sim.txt'), 'utf8');
const dir = path.join(root, 'test/realdevice/scripts');
const lines = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  const ctx = vm.createContext({});
  vm.runInContext(bundle, ctx);
  const host = ctx.JcreateppHost;
  host.load(fs.readFileSync(path.join(dir, file), 'utf8'), 0, 0, 0, 0, 0, 0, 1);
  // Same operations as SimHostCheck.cs.
  for (let i = 0; i < 30; i++) host.step(1 / 60);
  host.fire('interact', '', '');
  host.fire('receive', 'open', '');
  for (let i = 0; i < 90; i++) host.step(1 / 60);
  const s = host.snapshot();
  lines.push([file, ...s.position, ...s.rotation, s.time].join(' '));
}
fs.writeFileSync(process.argv[2], lines.join('\n') + '\n');
console.log(`expected: ${lines.length} scripts`);
