/**
 * Real-device check kit: small workspaces whose behavior must be confirmed on Cluster.
 * `npm run realdevice:export` writes them as JSON next to this file (load them in Jcreate++).
 * test/realdevice.test.ts checks that each converts cleanly and that the simulator shows the
 * expected result, so the device result can be compared with what Jcreate++ assumes.
 */

import { b, bool, num, onEvent, workspace, xyz } from '../build';

export type Scenario = {
  file: string;
  title: string;
  /** What it confirms on the device. */
  checks: string;
  state: object;
};

const up = (y: number) => b('jcreatepp_add_position', { inputs: xyz(0, y, 0) });
const arith = (op: string, a: object, c: object) => b('jcreatepp_arithmetic', { fields: { OP: op }, inputs: { A: a as any, B: c as any } });
const eq = (a: object, c: object) => b('jcreatepp_compare', { fields: { OP: 'EQ' }, inputs: { A: a as any, B: c as any } });

export const SCENARIOS: Scenario[] = [
  {
    file: 'rd1-position-immediate.json',
    title: '位置の即時反映',
    checks: '同じイベントの中で2回続けて位置を変えたとき、2回目が1回目の結果から動くか（多くのブロックの前提）',
    state: workspace(onEvent('jcreatepp_on_interact', [up(0.5), up(0.5)])),
  },
  {
    file: 'rd2-smooth-rotate.json',
    title: '秒数つき回転',
    checks: '傾いた状態から「〜秒かけて回す」がなめらかに回り、エラーにならないか（Quaternion の4引数コンストラクタ・アロー関数）',
    state: workspace(
      onEvent('jcreatepp_on_start', [b('jcreatepp_set_rotation', { inputs: xyz(30, 0, 0) })]),
      onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(2) } })]),
    ),
  },
  {
    file: 'rd3-decimal.json',
    title: '小数の計算',
    checks: '0.1 + 0.2 = 0.3 が「等しい」になるか（toPrecision と生成される補助関数）',
    state: workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_if_else', {
        inputs: { CONDITION: eq(arith('ADD', num(0.1), num(0.2)), num(0.3)) },
        stmts: { DO: [up(1)], ELSE: [up(-1)] },
      }),
    ])),
  },
  {
    file: 'rd4-sequence-timing.json',
    title: '待機のタイミング',
    checks: '「1秒待つ」×3 がほぼ3秒になるか',
    state: workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_sequence', { stmts: { DO: [
        up(1),
        b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
        b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
        b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
        up(-1),
      ] } }),
    ])),
  },
  {
    file: 'rd5-sequence-rerun.json',
    title: '一連の動作の再実行',
    checks: '一連の動作の中の「もし〜になった瞬間」が、2回目以降のインタラクトでも反応するか',
    state: workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_sequence', { stmts: { DO: [
        b('jcreatepp_if_edge', { inputs: { CONDITION: bool(true) }, stmts: { DO: [up(0.5)] } }),
        b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(0.5) } }),
      ] } }),
    ])),
  },
  {
    file: 'rd6-flag-bool.json',
    title: 'フラグと真偽値変数',
    checks: 'フラグで切り替えた値を、同じ名前の真偽値変数で読めるか',
    state: workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'lamp', OPERATION: 'toggle' } }),
      b('jcreatepp_if_else', {
        inputs: { CONDITION: b('jcreatepp_bool_var', { fields: { VAR_NAME: 'lamp' } }) },
        stmts: { DO: [up(1)], ELSE: [up(-1)] },
      }),
    ])),
  },
  {
    file: 'rd7-move-local.json',
    title: '向いている方向に進む',
    checks: '「前」がアイテムの青い矢印（+Z）の方向か（開始時に Y 90° 回してから進む）',
    state: workspace(
      onEvent('jcreatepp_on_start', [b('jcreatepp_set_rotation', { inputs: xyz(0, 90, 0) })]),
      onEvent('jcreatepp_on_interact', [b('jcreatepp_move_local', { inputs: xyz(0, 0, 1) })]),
    ),
  },
  {
    file: 'rd8-ride-forward.json',
    title: '乗り物の進む向き',
    checks: '「アイテムの前（+Z）」を選んだ乗り物が、前進キーで青い矢印の方向に進むか',
    state: workspace(b('jcreatepp_ride_template', {
      fields: { FORWARD_AXIS: 'Z' },
      inputs: { FORWARD_SPEED: num(3), UP_DOWN_SPEED: num(1), TURN_SPEED: num(60) },
    })),
  },
];
