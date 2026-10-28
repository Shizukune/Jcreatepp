// Writes the cases CoreHostCheck.cs runs on the real Jint, and what the core gives for each in Node
// (vm, no browser globals). Each case is <name>.input.json and <name>.expected.txt in <out dir>;
// the text format is the same as CoreHostCheck.Describe(). Parts are checked separately (their new
// block ids are random), see parts.expected.txt.
// Usage: node unity/check/expected-core.js <out dir>
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'unity/Jcreatepp/Editor/Core/jcreatepp-core.txt'), 'utf8'), ctx);
const core = ctx.JcreateppCore;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

/** Same text as CoreHostCheck.Describe(ConvertResult). */
function describe(r) {
  const lines = [`ok=${r.ok}`, `error=${r.error}`, `errors=${r.errors.length}`, ...r.errors, `warnings=${r.warnings.length}`];
  for (const w of r.warnings) lines.push([w.blockId, w.blockType, w.eventId, w.eventType, w.eventMessage, w.text].join('|'));
  lines.push(`size=${r.size.bytes}|${r.size.overLimit}|${r.size.text}`, `variables=${r.variables.length}`);
  for (const v of r.variables) lines.push([v.kind, v.name, v.stateKey].join('|'));
  lines.push(`setup=${r.setupJson}`, 'code=', r.code);
  return lines.join('\n');
}

const state = (blocks) => ({ blocks: { languageVersion: 0, blocks } });
const num = (n) => ({ block: { type: 'math_number', fields: { NUM: n } } });
/** Statements linked by next, innermost last. */
function chain(list) {
  let next;
  for (let i = list.length - 1; i >= 0; i--) next = { ...list[i], ...(next ? { next: { block: next } } : {}) };
  return next;
}
const onStart = (body) => ({ type: 'jcreatepp_on_start', x: 0, y: 0, ...(body ? { inputs: { DO: { block: body } } } : {}) });

const cases = {};
for (const f of fs.readdirSync(path.join(root, 'test/fixtures')).filter((f) => f.endsWith('.json'))) {
  cases['fixture-' + f.replace('.json', '')] = fs.readFileSync(path.join(root, 'test/fixtures', f), 'utf8');
}
for (const f of fs.readdirSync(path.join(root, 'test/realdevice')).filter((f) => /^rd.*\.json$/.test(f))) {
  cases['kit-' + f.replace('.json', '')] = fs.readFileSync(path.join(root, 'test/realdevice', f), 'utf8');
}
// Sort order of variable names (localeCompare) with Japanese, upper / lower case and accents.
const names = ['zeta', 'Éclair', 'apple', 'Banana', 'あいう', 'カタカナ', '漢字', 'eclair', 'Apple', '_x', '10', '9'];
cases['variable-order'] = JSON.stringify(state([onStart(chain(names.map((n) => ({ type: 'jcreatepp_set_number_var', fields: { VAR_NAME: n }, inputs: { VALUE: num(1) } }))))]));
// Over the craft item limit (thousands separators in the size text).
const moves = Array.from({ length: 140 }, () => ({ type: 'jcreatepp_add_position', inputs: { X: num(0.125), Y: num(0.25), Z: num(0.5) } }));
cases['over-craft-limit'] = JSON.stringify(state([onStart(chain(moves))]));
// Nesting: 150 levels is fine, 151 is refused before Blockly reads it.
const flat = (n) => Array.from({ length: n }, () => ({ type: 'jcreatepp_save_position' }));
cases['depth-150'] = JSON.stringify(state([{ type: 'jcreatepp_on_interact', inputs: { DO: { block: chain(flat(149)) } } }]));
cases['depth-151'] = JSON.stringify(state([{ type: 'jcreatepp_on_interact', inputs: { DO: { block: chain(flat(150)) } } }]));
cases['unknown-block'] = JSON.stringify(state([{ type: 'jcreatepp_future_block' }]));
cases['broken-json'] = '{';

for (const [name, json] of Object.entries(cases)) {
  fs.writeFileSync(path.join(out, name + '.input.json'), json);
  fs.writeFileSync(path.join(out, name + '.expected.txt'), describe(core.convert(json)));
}

// Parts: on an empty workspace and on the door kit script. One line per case:
// <part id> <base> <ok> <conversion errors after adding, joined by " / "> | <error when refused>
const bases = { empty: '{}', door: cases['kit-rd10-door'] };
const partLines = [];
for (const p of core.parts()) {
  for (const [base, json] of Object.entries(bases)) {
    const r = core.addPart(json, p.id, '');
    const errors = r.ok ? core.convert(r.json).errors.join(' / ') : '';
    partLines.push([p.id, base, r.ok, errors, r.error].join('\t'));
  }
}
fs.writeFileSync(path.join(out, 'parts.expected.txt'), partLines.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'empty.input.json'), bases.empty);
const v = core.version();
fs.writeFileSync(path.join(out, 'version.expected.txt'), [v.format, v.jcreatepp, v.blockly, v.blockTypes.length].join(' ') + '\n');
console.log(`expected (core): ${Object.keys(cases).length} cases, ${partLines.length} part additions`);
