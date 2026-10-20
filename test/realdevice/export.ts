/**
 * Writes the real-device kit (npm run realdevice:export): workspace JSON, generated scripts and
 * CHECKLIST.md, all built from scenarios.ts by kit.ts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { kitFiles } from './kit';

// Compiled to .test-build/test/realdevice/, sources live in test/realdevice/
const outDir = path.resolve(__dirname, '../../../test/realdevice');
for (const file of kitFiles()) {
  const target = path.join(outDir, file.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.content);
  console.log(`wrote ${file.path}`);
}
