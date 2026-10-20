/**
 * Everything the real-device kit writes, built from scenarios.ts: the workspace JSON, the generated
 * Cluster Script for each scenario (scripts/), and the checklist (CHECKLIST.md) whose file names and
 * steps come from the same data, so they never drift apart.
 * export.ts writes these files; test/realdevice.test.ts checks that the committed ones are current.
 */

import { collectUnityRequirements, formatUnityRequirements } from '../../src/unityRequirements';
import { describeScriptSize, scriptByteLength } from '../../src/unitySetup';
import { convertState, generateCode } from '../harness';
import { SCENARIOS, type Scenario } from './scenarios';

export type KitFile = { path: string; content: string };

export const scriptName = (s: Scenario) => s.file.replace(/\.json$/, '.js');
const id = (s: Scenario) => s.file.replace(/-.*$/, '');

function unitySetupLines(s: Scenario): string[] {
  const { program } = convertState(s.state);
  const requirements = collectUnityRequirements(program);
  const text = formatUnityRequirements(requirements);
  const generated = text ? text.split('\n').slice(1).map((l) => l.replace(/^- /, '')) : [];
  // The generic "movable" guidance, made concrete: moved by the script = kinematic; rd14 moves by physics.
  const movable = requirements.some((r) => r.kind === 'movable_item');
  const concrete = s.physics
    ? ['Movable Item を付け、Rigidbody の **Is Kinematic はオフ・Use Gravity はオン**にする（物理で動かす）']
    : movable
      ? ['Movable Item を付け、Rigidbody の **Is Kinematic をオン**にする（スクリプトで動かすため。オフだと物理と取り合いになる）']
      : [];
  return ['Item と Scriptable Item を付け、Source Code Asset に下のスクリプトを入れる', ...concrete, ...generated, ...(s.setup ?? [])];
}

function checklist(): string {
  const lines: string[] = [];
  lines.push('# 実機テスト 手順書');
  lines.push('');
  lines.push('> このファイルは `npm run realdevice:export` で作られます。手で直さず、`test/realdevice/scenarios.ts` を直してください。');
  lines.push('');
  lines.push('## 使い方');
  lines.push('');
  lines.push('1. Unity のプロジェクトに `scripts/` フォルダの `.js` をそのままコピーする（Assets の中ならどこでもよい）');
  lines.push('   - Cluster Creator Kit が `.js` を自動で JavaScript Asset として読み込みます');
  lines.push('2. シナリオごとに立方体などを置き、下の「Unity の準備」をする');
  lines.push('   - スクリプトは Scriptable Item の **Source Code Asset** に `.js` をドラッグする');
  lines.push('   - 向きを確かめるシナリオ（rd7・rd8・rd16）では、Item を付けたオブジェクトの青い矢印（Local 表示の +Z）が見えるようにしておく');
  lines.push('3. ワールドを**アップロードして** Cluster で確かめる（テスト用スペースが便利）');
  lines.push('   - Unity のプレビュー（エディタ内のプレビュー）では Scriptable Item が動かないので、プレビューでは確かめられません');
  lines.push('   - エラーが出たかは、Cluster の「スクリプトログ」で見られます');
  lines.push('   - rd15・rd16 は、ほかのプレイヤーがいない状態で行う（近くの誰にでも反応するため）');
  lines.push('4. 下の一覧の「結果」に ○ / × を書く。× のときは実際の動きもメモして、Claude Code に伝える');
  lines.push('');
  lines.push('Jcreate++ で中身を見たいときは、同じ名前の `.json` を `workspace読込` で読み込めます。');
  lines.push('');
  lines.push('## 一覧');
  lines.push('');
  lines.push('| # | スクリプト | 確かめること | 操作 | 期待する結果 | 結果 |');
  lines.push('|---|---|---|---|---|---|');
  for (const s of SCENARIOS) {
    lines.push(`| ${id(s)} | \`scripts/${scriptName(s)}\` | ${s.title} | ${s.operation} | ${s.expected} |  |`);
  }
  lines.push('');
  lines.push('- rd1〜rd8: Jcreate++ が前提にしている細かい動き（ずれると多くのブロックに影響）');
  lines.push('- rd9〜rd16: よく使う機能がひととおり動くか');
  lines.push('- rd11a と rd11b は 2 つで 1 組です（同じワールドに置く）');
  lines.push('');
  lines.push('## シナリオごとの手順');
  for (const s of SCENARIOS) {
    const size = describeScriptSize(scriptByteLength(generateCode(s.state)));
    lines.push('');
    lines.push(`### ${id(s)} ${s.title}`);
    lines.push('');
    lines.push(`- スクリプト: \`scripts/${scriptName(s)}\`（ブロック: \`${s.file}\`）`);
    lines.push(`- 確かめること: ${s.checks}`);
    lines.push('- Unity の準備:');
    for (const l of unitySetupLines(s)) lines.push(`  - ${l}`);
    lines.push(`- 操作: ${s.operation}`);
    lines.push(`- 期待する結果: ${s.expected}`);
    lines.push(`- 違ったら: ${s.ifWrong}`);
    lines.push(`- ${size.text}`);
  }
  lines.push('');
  lines.push('## 結果の記録');
  lines.push('');
  lines.push('日付・Cluster Creator Kit のバージョン・Unity のバージョン・結果をこのファイルの「結果」列か、別のメモに残してください。');
  lines.push('');
  return lines.join('\n');
}

export function kitFiles(): KitFile[] {
  const files: KitFile[] = [];
  for (const s of SCENARIOS) {
    files.push({ path: s.file, content: JSON.stringify(s.state, null, 2) + '\n' });
    const header = `// Jcreate++ 実機テスト ${id(s)}「${s.title}」 — 手順は CHECKLIST.md\n`;
    files.push({ path: `scripts/${scriptName(s)}`, content: header + generateCode(s.state) });
  }
  files.push({ path: 'CHECKLIST.md', content: checklist() });
  return files;
}
