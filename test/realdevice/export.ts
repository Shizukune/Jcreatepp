/**
 * Writes the real-device scenarios as Jcreate++ workspace JSON files (npm run realdevice:export).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCENARIOS } from './scenarios';

// Compiled to .test-build/test/realdevice/, sources live in test/realdevice/
const outDir = path.resolve(__dirname, '../../../test/realdevice');
for (const scenario of SCENARIOS) {
  fs.writeFileSync(path.join(outDir, scenario.file), JSON.stringify(scenario.state, null, 2) + '\n');
  console.log(`wrote ${scenario.file}`);
}
