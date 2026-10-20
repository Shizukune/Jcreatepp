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
  /** What to do on Cluster. */
  operation: string;
  /** What should happen (the simulator agrees: test/realdevice.test.ts). */
  expected: string;
  /** What a different result means. */
  ifWrong: string;
  /** Moved by physics (Is Kinematic off) instead of by the script. */
  physics?: boolean;
  /** Unity setup beyond the generated "Unity側で必要な設定" (objects to make, clips, ...). */
  setup?: string[];
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
    operation: 'インタラクトを1回',
    expected: '**1 上がる**（0.5 × 2）',
    ifWrong: '0.5 しか上がらない → 位置を設定した直後に読むと古い値が返る。「〜ずつ変える」を続けて使うブロック全般の前提が崩れる',
    state: workspace(onEvent('jcreatepp_on_interact', [up(0.5), up(0.5)])),
  },
  {
    file: 'rd2-smooth-rotate.json',
    title: '秒数つき回転',
    checks: '傾いた状態から「〜秒かけて回す」がなめらかに回り、エラーにならないか（Quaternion の4引数コンストラクタ・アロー関数）',
    operation: 'インタラクト',
    expected: '前に 30° 傾いた状態から、**2秒かけてなめらかに 90° 回る**。エラーが出ない',
    ifWrong: '回らない・コンソールにエラー → Quaternion の4引数の作り方か、アロー関数が使えない',
    state: workspace(
      onEvent('jcreatepp_on_start', [b('jcreatepp_set_rotation', { inputs: xyz(30, 0, 0) })]),
      onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(2) } })]),
    ),
  },
  {
    file: 'rd3-decimal.json',
    title: '小数の計算',
    checks: '0.1 + 0.2 = 0.3 が「等しい」になるか（toPrecision と生成される補助関数）',
    operation: 'インタラクト',
    expected: '**1 上がる**',
    ifWrong: '下がる → 小数の丸め（toPrecision）が実機で効いていない',
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
    operation: 'インタラクトしてストップウォッチで計る',
    expected: '1 上がり、**約3秒後**に戻る',
    ifWrong: '大きくずれる → 待機の時間計算の前提が違う',
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
    operation: '1秒ほど間をあけて3回インタラクト',
    expected: '**毎回 0.5 上がる**（合計 1.5）',
    ifWrong: '1回目しか上がらない → 一連の動作の再実行時のリセットが効いていない',
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
    operation: 'インタラクトを2回',
    expected: '**1回目で上がり、2回目で下がる**',
    ifWrong: '下がる→下がる → フラグと真偽値変数の統合が効いていない',
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
    operation: 'インタラクト',
    expected: '開始時に右へ 90° 向き、インタラクトで**青い矢印（向いている方）へ 1 進む**',
    ifWrong: '別の方向に進む → 「前＝+Z」の前提が実機と違う',
    state: workspace(
      onEvent('jcreatepp_on_start', [b('jcreatepp_set_rotation', { inputs: xyz(0, 90, 0) })]),
      onEvent('jcreatepp_on_interact', [b('jcreatepp_move_local', { inputs: xyz(0, 0, 1) })]),
    ),
  },
  {
    file: 'rd8-ride-forward.json',
    title: '乗り物の進む向き',
    checks: '「アイテムの前（+Z）」を選んだ乗り物が、前進キーで青い矢印の方向に進むか',
    operation: '乗って前進キー、次に右キー',
    expected: '**青い矢印の方向へ進む**。右キーで右に曲がる',
    ifWrong: '左や後ろに進む → 乗り物の「アイテムの前（+Z）」の計算が実機と違う',
    setup: ['Seat（座る位置）用の子オブジェクトを作り、Ridable Item の Seat に設定する'],
    state: workspace(b('jcreatepp_ride_template', {
      fields: { FORWARD_AXIS: 'Z' },
      inputs: { FORWARD_SPEED: num(3), UP_DOWN_SPEED: num(1), TURN_SPEED: num(60) },
    })),
  },

  // ── 主要な機能（rd9〜）: よく使うブロックが実機で動くか ──
  {
    file: 'rd9-spin-bob.json',
    title: '回り続ける・往復する',
    checks: '毎フレームの回転と往復が、なめらかに・ほかのプレイヤーにも同じように見えるか',
    operation: '入室して 10 秒ほど見る（もう1つのアカウントか、ほかの人にも見てもらうとなおよい）',
    expected: 'Y 軸のまわりを **1 秒に 45°** 回りながら、**上下に ±0.5 m** 行ったり来たりする',
    ifWrong: 'カクカク・ほかの人には止まって見える → 毎フレームの位置・回転の更新が同期されていない（Item の Movement Type を確認）',
    state: workspace(onEvent('jcreatepp_on_update', [
      b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(45) } }),
      b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(0.5), SPEED: num(2) } }),
    ])),
  },
  {
    file: 'rd10-door.json',
    title: 'ドア（部品と同じ組み立て）',
    checks: 'フラグ・クールダウン・秒数つき回転を組み合わせたギミックが動くか（部品「ドア（開け閉め）」と同じブロック）',
    operation: 'インタラクト → 2 秒待って もう一度インタラクト。次に、開いている途中ですばやく2回インタラクト',
    expected: '1 回目で **1 秒かけて 90° 開き**、2 回目で **閉じる**。動いている途中のクリックは**無視される**',
    ifWrong: '途中のクリックで止まる・逆に回る → クールダウンの残り時間の計算が実機と違う',
    state: workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_if', {
        inputs: { CONDITION: b('jcreatepp_not', { inputs: { BOOL: b('jcreatepp_cooldown_active', { fields: { COOLDOWN_NAME: 'ドアが動いている' } }) } }) },
        stmts: { DO: [
          b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: 'ドアが動いている' }, inputs: { SECONDS: num(1) } }),
          b('jcreatepp_if_else', {
            inputs: { CONDITION: b('jcreatepp_flag', { fields: { FLAG_NAME: 'ドアが開いている' } }) },
            stmts: {
              DO: [
                b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, -90, 0), DURATION: num(1) } }),
                b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'ドアが開いている', OPERATION: 'false' } }),
              ],
              ELSE: [
                b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } }),
                b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'ドアが開いている', OPERATION: 'true' } }),
              ],
            },
          }),
        ] },
      }),
    ])),
  },
  {
    file: 'rd11a-message-sender.json',
    title: 'メッセージ（送る側）',
    checks: '指定アイテムへの送信と、返事の受信（rd11b と 2 つで 1 組）',
    operation: '送る側をインタラクト',
    expected: '受け取る側が **1 秒かけて 1 m 上がり始め**、ほぼ同時に送る側が **45° 回る**（返事 ack は受け取った直後に返るので、上がり終わるのを待たない）',
    ifWrong: '受け取る側が動かない → World Item Reference List の設定か、指定アイテムへの送信が違う。受け取る側だけ動く → 返事（送ってきた相手に返す）が届いていない',
    setup: [
      'このアイテムと rd11b のアイテムを、同じワールドに置く',
      'World Item Reference List の「receiver」には rd11b のアイテムを入れる',
    ],
    state: workspace(
      onEvent('jcreatepp_on_interact', [
        b('jcreatepp_send_message_to_item_once', { fields: { ITEM_NAME: 'receiver', MESSAGE: 'open' }, inputs: { CONDITION: bool(true) } }),
      ]),
      onEvent('jcreatepp_on_receive', [b('jcreatepp_add_rotation', { inputs: xyz(0, 45, 0) })], { MESSAGE: 'ack' }),
    ),
  },
  {
    file: 'rd11b-message-receiver.json',
    title: 'メッセージ（受け取る側）',
    checks: 'メッセージを受け取って動き、送ってきた相手に返事をするか（rd11a と 2 つで 1 組）',
    operation: '（rd11a の送る側をインタラクトする）',
    expected: '**1 秒かけて 1 m 上がる**。上がり始めると同時に、送る側へ返事 ack を送る',
    ifWrong: 'rd11a を見てください',
    setup: ['このアイテムを、rd11a の World Item Reference List の「receiver」に入れる'],
    state: workspace(onEvent('jcreatepp_on_receive', [
      b('jcreatepp_smooth_move_by', { inputs: { ...xyz(0, 1, 0), DURATION: num(1) } }),
      b('jcreatepp_reply_message_once', { fields: { MESSAGE: 'ack' }, inputs: { CONDITION: bool(true) } }),
    ], { MESSAGE: 'open' })),
  },
  {
    file: 'rd12-sound-text.json',
    title: '音と文字',
    checks: '音を鳴らす・サブノードの文字を数値で書き換える',
    operation: 'インタラクトを3回',
    expected: '押すたびに **音「se」が鳴り**、文字が **0 → 1 → 2 → 3** と増える',
    ifWrong: '音が出ない → Item Audio Set List の ID。文字が変わらない → サブノード名か TextView の設定',
    setup: [
      'Item Audio Set List に ID「se」で短い効果音を登録する',
      '「Label」は子オブジェクトとして作る（TextView の初めの文字は空でよい）',
    ],
    state: workspace(
      onEvent('jcreatepp_on_start', [
        b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'count' }, inputs: { VALUE: num(0) } }),
        b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'Label', COMPONENT: 'TextView' }, inputs: { TEXT: b('jcreatepp_number_var', { fields: { VAR_NAME: 'count' } }) } }),
      ]),
      onEvent('jcreatepp_on_interact', [
        b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'count' }, inputs: { DELTA: num(1) } }),
        b('jcreatepp_play_audio', { fields: { AUDIO_ID: 'se' }, inputs: { VOLUME: num(1) } }),
        b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'Label', COMPONENT: 'TextView' }, inputs: { TEXT: b('jcreatepp_number_var', { fields: { VAR_NAME: 'count' } }) } }),
      ]),
    ),
  },
  {
    file: 'rd13-grab.json',
    title: 'つかむ・離す',
    checks: '持ったとき・離したときのイベント',
    operation: 'アイテムを持つ → 離す',
    expected: '持つと文字が **「持った」**、離すと **「離した」** になる',
    ifWrong: '持てない → Grabbable Item / Collider の設定。文字が変わらない → つかむイベントが発生していない',
    setup: ['「Label」は子オブジェクトとして作る'],
    state: workspace(
      onEvent('jcreatepp_on_grab_start', [
        b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'Label', COMPONENT: 'TextView' }, inputs: { TEXT: b('jcreatepp_string_literal', { fields: { TEXT: '持った' } }) } }),
      ]),
      onEvent('jcreatepp_on_grab_end', [
        b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'Label', COMPONENT: 'TextView' }, inputs: { TEXT: b('jcreatepp_string_literal', { fields: { TEXT: '離した' } }) } }),
      ]),
    ),
  },
  {
    file: 'rd14-collide.json',
    title: '衝突',
    physics: true,
    checks: '衝突イベントの回数（物理で動くアイテム）',
    operation: '少し高い所に置いて落とす（または持って床に投げる）',
    expected: '床や壁にぶつかるたびに、文字の数字が **1 ずつ増える**',
    ifWrong: '増えない → 物理で動く設定（Movable Item・Rigidbody）か Collider。触れているあいだ増え続ける → 衝突イベントの発生の仕方が想定と違う',
    setup: [
      '「Label」は子オブジェクトとして作る',
    ],
    state: workspace(onEvent('jcreatepp_on_collide', [
      b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'hits' }, inputs: { DELTA: num(1) } }),
      b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'Label', COMPONENT: 'TextView' }, inputs: { TEXT: b('jcreatepp_number_var', { fields: { VAR_NAME: 'hits' } }) } }),
    ])),
  },
  {
    file: 'rd15-player-near.json',
    title: '近くのプレイヤー',
    checks: '範囲内のプレイヤーの検知',
    operation: 'アイテムから 5 m 以上離れる → 3 m 以内に近づく → また離れる',
    expected: '**3 m 以内にいるあいだだけ回る**。離れると止まる',
    ifWrong: 'ずっと回る・回らない → 範囲の距離の測り方が違う',
    state: workspace(onEvent('jcreatepp_on_update', [
      b('jcreatepp_if', {
        inputs: { CONDITION: b('jcreatepp_players_near', { inputs: { RANGE: num(3) } }) },
        stmts: { DO: [b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(90) } })] },
      }),
    ])),
  },
  {
    file: 'rd16-chase.json',
    title: '追いかけるギミック',
    checks: '完成済みの追いかけるギミック',
    operation: 'アイテムから 5 m ほど離れて立つ → 歩いて逃げる',
    expected: '**こちらを向いて近づき**、1.5 m ほどで止まる。10 m より遠いと追いかけない',
    ifWrong: '後ろ向きに進む → 向きの計算。近づきすぎる・離れない → 距離の測り方が違う',
    state: workspace(b('jcreatepp_chase_template', { inputs: { MOVE_SPEED: num(2), MAX_DISTANCE: num(10), MIN_DISTANCE: num(1.5) } })),
  },
];
