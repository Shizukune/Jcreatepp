const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../Jcreatepp/Editor/Core/jcreatepp-core.txt'), 'utf8'), ctx);
for (const kind of ['Interact', 'Toggle', 'Sequence', 'Cooldown', 'Receive']) {
  for (const mode of ['preview', 'insert']) {
    const text = fs.readFileSync(path.join(process.argv[2], `${kind}-${mode}.json`), 'utf8');
    const result = ctx.JcreateppCore.convert(text);
    if (!result.ok || result.errors.length || !result.code) throw new Error(`${kind}-${mode}: ${result.error} ${result.errors}`);
  }
}
console.log('beginner templates: all 10 C# workspaces convert in the shipped core');
