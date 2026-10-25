/**
 * The one-line Japanese text of a simulator log entry. Pure; shared by the Web preview (panel.ts)
 * and the Unity preview (src/unityHost/host.ts), so both say the same thing.
 */

import type { LogEntry } from '../sim/clusterMock';

export function formatLog(l: LogEntry): string {
  switch (l.type) {
    case 'send': return `送信 → ${l.target}「${l.message}」${l.arg === null || l.arg === undefined ? '' : ` 値=${JSON.stringify(l.arg)}`}`;
    case 'audio': return `音「${l.id}」音量 ${l.volume}`;
    case 'text': return `文字 ${l.subNode}(${l.component}) = ${l.text}`;
    case 'enabled': return `${l.subNode}(${l.component}) を ${l.enabled ? '有効' : '無効'}`;
    case 'force': return `力を加える (${l.force.x.toFixed(1)}, ${l.force.y.toFixed(1)}, ${l.force.z.toFixed(1)}) ※物理は再現しません`;
    case 'player': return `プレイヤー ${l.method}(${l.value})`;
    case 'error': return `エラー[${l.event}] ${l.message}`;
  }
}
