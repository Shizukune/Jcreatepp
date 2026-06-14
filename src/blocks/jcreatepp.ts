/**
 * Jcreate++ カスタムブロック定義
 *
 * イベント系 (top-level only, hat 形状):
 *   - 開始時   → $.onStart
 *   - 毎フレーム → $.onUpdate
 *   - インタラクト時 → $.onInteract
 *
 * 動作系 (位置設定 / 回転設定):
 *   - 移動 (move)   = 位置設定系 → $.setPosition
 *   - 回転 (rotate) = 回転設定系 → $.setRotation
 *
 * Cluster Script Reference:
 *   https://docs.cluster.mu/script/interfaces/ClusterScript.html
 */

import * as Blockly from 'blockly/core';

// ── イベントブロック ──
// hat 形状: previousStatement / nextStatement なし → 他のブロックの中に入れられない
// 同種イベントの重複禁止は validator.ts で検出する

const onStart = {
  type: 'jcreatepp_on_start',
  message0: '開始時 %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'アイテムが空間に現れたとき、1回だけ実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart',
  hat: 'cap',
};

const onUpdate = {
  type: 'jcreatepp_on_update',
  message0: '毎フレーム %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'フレームごとに繰り返し実行されます（deltaTime 付き）',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate',
  hat: 'cap',
};

const onInteract = {
  type: 'jcreatepp_on_interact',
  message0: 'インタラクト時 %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'プレイヤーがアイテムに「使う」動作をしたときに実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
  hat: 'cap',
};

const onGrabStart = {
  type: 'jcreatepp_on_grab_start',
  message0: '持ったとき %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'プレイヤーがアイテムを掴んだ瞬間に実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#ongrab',
  hat: 'cap',
};

const onGrabEnd = {
  type: 'jcreatepp_on_grab_end',
  message0: '離したとき %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'プレイヤーがアイテムを手放した瞬間に実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#ongrab',
  hat: 'cap',
};

const onReceive = {
  type: "jcreatepp_on_receive",
  message0: "メッセージ %1 を受け取ったとき %2 %3",
  args0: [
    { type: "field_input", name: "MESSAGE", text: "open" },
    { type: "input_dummy" },
    { type: "input_statement", name: "DO" },
  ],
  colour: 45,
  tooltip: "指定したメッセージを受け取ったときに実行されます",
  helpUrl: "https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive",
  hat: "cap",
};

// ── 動作ブロック ──
// previousStatement / nextStatement あり → イベントの body に接続可能

const setPositionBlock = {
  type: 'jcreatepp_set_position',
  message0: '位置を x: %1 y: %2 z: %3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムを指定した絶対座標に移動します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const addPositionBlock = {
  type: 'jcreatepp_add_position',
  message0: '位置を x: %1 y: %2 z: %3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の位置から、指定した座標分だけ相対的に移動します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const setRotationBlock = {
  type: 'jcreatepp_set_rotation',
  message0: '角度を x: %1 y: %2 z: %3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムの角度を指定した絶対角度にします',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

const addRotationBlock = {
  type: 'jcreatepp_add_rotation',
  message0: '角度を x: %1 y: %2 z: %3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の角度から、指定した角度分だけ回転させます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

// ── 新規動作ブロック ──

const randomWarpBlock = {
  type: 'jcreatepp_random_warp',
  message0: '現在の位置から範囲 X: %1 Z: %2 へランダム移動する',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' }
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在地から指定されたX/Z範囲内のランダムな位置へワープします。',
  helpUrl: '',
};

const savePositionBlock = {
  type: 'jcreatepp_save_position',
  message0: '今の位置を保存する',
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の位置を記憶します（保存できるのは1箇所のみです）。',
  helpUrl: '',
};

const loadPositionBlock = {
  type: 'jcreatepp_load_position',
  message0: '保存した位置に戻る',
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '最後に保存した位置へ移動します。',
  helpUrl: '',
};

const addForceBlock = {
  type: 'jcreatepp_add_force',
  message0: '%1 の強さで X: %2 Y: %3 Z: %4 の方向に力を加える',
  args0: [
    { type: 'input_value', name: 'POWER', check: 'Number' },
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' }
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '指定した方向へ瞬発的な力を加えます。',
  helpUrl: '',
};

const oscillateBlock = {
  type: 'jcreatepp_oscillate',
  message0: '%1 方向に 幅: %2 速さ: %3 で往復する',
  args0: [
    {
      type: 'field_dropdown',
      name: 'AXIS',
      options: [
        ['左右(X)', 'X'],
        ['上下(Y)', 'Y'],
        ['前後(Z)', 'Z']
      ]
    },
    { type: 'input_value', name: 'WIDTH', check: 'Number' },
    { type: 'input_value', name: 'SPEED', check: 'Number' }
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '初期位置を基準に、指定した方向へサイン波で往復し続けます。（毎フレーム内で使用）',
  helpUrl: '',
};

const continuousRotationBlock = {
  type: 'jcreatepp_continuous_rotation',
  message0: '%1 軸を 速度 %2 で回転し続ける',
  args0: [
    {
      type: 'field_dropdown',
      name: 'AXIS',
      options: [
        ['X', 'X'],
        ['Y', 'Y'],
        ['Z', 'Z'],
      ],
    },
    { type: 'input_value', name: 'SPEED', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '指定した軸を中心に毎フレーム回転し続けます（毎フレーム内で使用）。',
  helpUrl: '',
};

const timedRandomWarpBlock = {
  type: 'jcreatepp_timed_random_warp',
  message0: '%1 秒ごとに 範囲 %2 へランダムワープ',
  args0: [
    { type: 'input_value', name: 'INTERVAL', check: 'Number' },
    { type: 'input_value', name: 'RANGE', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在位置を中心に、指定秒ごとにXZ範囲内へランダム移動します（毎フレーム内で使用）。',
  helpUrl: '',
};

const timedMoveReturnBlock = {
  type: 'jcreatepp_timed_move_return',
  message0: 'X:%1 Y:%2 Z:%3 方向へ 速度 %4 で %5 秒移動して戻る',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
    { type: 'input_value', name: 'SPEED', check: 'Number' },
    { type: 'input_value', name: 'DURATION', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '初期位置を記録し、指定方向へ一定時間移動したあと元の位置に戻ります（毎フレーム内で使用）。',
  helpUrl: '',
};

const setMoveSpeedBlock = {
  type: 'jcreatepp_set_move_speed',
  message0: 'プレイヤーの移動速度倍率を %1 にする',
  args0: [
    { type: 'input_value', name: 'RATE', check: 'Number' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'インタラクト時、持ったとき、離したときにプレイヤーの移動速度倍率を変更します。',
  helpUrl: 'https://docs.cluster.mu/script/classes/PlayerHandle.html#setmovespeedrate',
};

const setJumpSpeedBlock = {
  type: 'jcreatepp_set_jump_speed',
  message0: 'プレイヤーのジャンプ速度倍率を %1 にする',
  args0: [
    { type: 'input_value', name: 'RATE', check: 'Number' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'インタラクト時、持ったとき、離したときにプレイヤーのジャンプ速度倍率を変更します。',
  helpUrl: 'https://docs.cluster.mu/script/classes/PlayerHandle.html#setjumpspeedrate',
};

// ── 完成済みギミック ──

const rideTemplateBlock = {
  type: 'jcreatepp_ride_template',
  message0: '乗り物ギミック %1 前進速度: %2 上下速度: %3 旋回速度: %4',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_value', name: 'FORWARD_SPEED', check: 'Number' },
    { type: 'input_value', name: 'UP_DOWN_SPEED', check: 'Number' },
    { type: 'input_value', name: 'TURN_SPEED', check: 'Number' }
  ],
  colour: 0,
  tooltip: '置いて数値を設定するだけで乗り物が完成する特別なブロックです。',
  helpUrl: '',
  hat: 'cap',
};

const chaseTemplateBlock = {
  type: 'jcreatepp_chase_template',
  message0: '追いかけるギミック %1 速度: %2 最大距離: %3 最小距離: %4',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_value', name: 'MOVE_SPEED', check: 'Number' },
    { type: 'input_value', name: 'MAX_DISTANCE', check: 'Number' },
    { type: 'input_value', name: 'MIN_DISTANCE', check: 'Number' },
  ],
  colour: 0,
  tooltip: '近くのプレイヤーを探して向きを合わせ、一定距離まで追いかける完成済みギミックです。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#getplayersnear',
  hat: 'cap',
};

// ── 制御ブロック ──

const ifBlock = {
  type: 'jcreatepp_if',
  message0: 'もし %1 なら %2 %3',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件が true のときだけ中身を実行します',
  helpUrl: '',
};

const ifElseBlock = {
  type: 'jcreatepp_if_else',
  message0: 'もし %1 なら %2 %3 でなければ %4 %5',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'ELSE' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件が true のときは上のブロックを、false のときは下のブロックを実行します',
  helpUrl: '',
};

// ── シーケンス・待機ブロック ──

const sequenceBlock = {
  type: 'jcreatepp_sequence',
  message0: '一連の動作（完了まで待つ） %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: 'この中に入れた待機ブロックは順番に実行されます。',
  helpUrl: '',
};

const waitSecondsBlock = {
  type: 'jcreatepp_wait_seconds',
  message0: '%1 秒待つ',
  args0: [
    { type: 'input_value', name: 'SECONDS', check: 'Number' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '指定した秒数だけ待機します（一連の動作ブロックの中でしか使えません）',
  helpUrl: '',
};

const waitUntilBlock = {
  type: 'jcreatepp_wait_until',
  message0: '%1 まで待つ',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '条件が true になるまで待機します（一連の動作ブロックの中でしか使えません）',
  helpUrl: '',
};

// ── 条件ブロック ──

const runForSecondsBlock = {
  type: 'jcreatepp_run_for_seconds',
  message0: '%1 秒間、毎フレーム実行する %2 %3',
  args0: [
    { type: 'input_value', name: 'SECONDS', check: 'Number' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '指定した秒数の間、中のブロックを毎フレーム実行します（一連の動作の中でのみ使用できます）。',
  helpUrl: '',
};

const compareBlock = {
  type: 'jcreatepp_compare',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Number' },
    {
      type: 'field_dropdown',
      name: 'OP',
      options: [
        ['=', 'EQ'],
        ['!=', 'NEQ'],
        ['<', 'LT'],
        ['<=', 'LTE'],
        ['>', 'GT'],
        ['>=', 'GTE']
      ]
    },
    { type: 'input_value', name: 'B', check: 'Number' }
  ],
  output: 'Boolean',
  colour: 210,
  inputsInline: true,
  tooltip: '2つの値を比較して真偽値を返します',
  helpUrl: '',
};

const notBlock = {
  type: 'jcreatepp_not',
  message0: '%1 ではない',
  args0: [
    { type: 'input_value', name: 'BOOL', check: 'Boolean' }
  ],
  output: 'Boolean',
  colour: 210,
  tooltip: '真偽値を反転させます',
  helpUrl: '',
};

const andBlock = {
  type: 'jcreatepp_and',
  message0: '%1 かつ %2',
  args0: [
    { type: 'input_value', name: 'A', check: 'Boolean' },
    { type: 'input_value', name: 'B', check: 'Boolean' }
  ],
  inputsInline: true,
  output: 'Boolean',
  colour: 210,
  tooltip: '両方の条件が満たされているか判定します',
  helpUrl: '',
};

const orBlock = {
  type: 'jcreatepp_or',
  message0: '%1 または %2',
  args0: [
    { type: 'input_value', name: 'A', check: 'Boolean' },
    { type: 'input_value', name: 'B', check: 'Boolean' }
  ],
  inputsInline: true,
  output: 'Boolean',
  colour: 210,
  tooltip: 'どちらかの条件が満たされているか判定します',
  helpUrl: '',
};

// ── 変数ブロック ──

const flagBlock = {
  type: 'jcreatepp_flag',
  message0: 'フラグ %1',
  args0: [
    { type: 'field_input', name: 'FLAG_NAME', text: '名前' }
  ],
  output: 'Boolean',
  colour: 330,
  tooltip: '指定した名前のフラグ（True/False）の値を取得します。',
  helpUrl: '',
};

const setFlagBlock = {
  type: 'jcreatepp_set_flag',
  message0: 'フラグ %1 を %2 にする',
  args0: [
    { type: 'field_input', name: 'FLAG_NAME', text: '名前' },
    {
      type: 'field_dropdown',
      name: 'OPERATION',
      options: [
        ['true', 'true'],
        ['false', 'false'],
        ['切り替える', 'toggle']
      ]
    }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定したフラグの値を変更します。',
  helpUrl: '',
};

// ── 文脈つき値ブロック ──
// 文脈ルール（どのイベントで使えるか）は blocks/context.ts が正本。
// ここでは形状・色・表示名のみ定義する。

const numberVarBlock = {
  type: 'jcreatepp_number_var',
  message0: '数値変数 %1',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'score' }
  ],
  output: 'Number',
  colour: 330,
  tooltip: '指定した名前の数値変数を読み取ります。',
  helpUrl: '',
};

const setNumberVarBlock = {
  type: 'jcreatepp_set_number_var',
  message0: '数値変数 %1 を %2 にする',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'score' },
    { type: 'input_value', name: 'VALUE', check: 'Number' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した名前の数値変数に値を入れます。',
  helpUrl: '',
};

const changeNumberVarBlock = {
  type: 'jcreatepp_change_number_var',
  message0: '数値変数 %1 を %2 だけ増やす',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'score' },
    { type: 'input_value', name: 'DELTA', check: 'Number' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した名前の数値変数を増減します。負の値を入れると減ります。',
  helpUrl: '',
};

const arithmeticBlock = {
  type: 'jcreatepp_arithmetic',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Number' },
    {
      type: 'field_dropdown',
      name: 'OP',
      options: [
        ['+', 'ADD'],
        ['-', 'SUB'],
        ['*', 'MUL'],
        ['/', 'DIV']
      ]
    },
    { type: 'input_value', name: 'B', check: 'Number' }
  ],
  output: 'Number',
  colour: 230,
  inputsInline: true,
  tooltip: '2つの数値を計算します。',
  helpUrl: '',
};

const sendMessageOnceBlock = {
  type: 'jcreatepp_send_message_once',
  message0: 'もし %1 になったら 範囲 %2 m のアイテムに メッセージ %3 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_value', name: 'RANGE', check: 'Number' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件が false から true になった瞬間だけ、近くのアイテムへメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const sendMessageToItemOnceBlock = {
  type: 'jcreatepp_send_message_to_item_once',
  message0: 'もし %1 になったら 指定アイテム %2 に メッセージ %3 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'ITEM_NAME', text: 'door' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件が false から true になった瞬間だけ、Unity/Cluster 側で指定したアイテム参照へメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const replyMessageOnceBlock = {
  type: 'jcreatepp_reply_message_once',
  message0: 'もし %1 になったら 送ってきた相手に メッセージ %2 を1回だけ返す',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'MESSAGE', text: 'ok' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: 'メッセージ受信イベントの中で、送信元へ1回だけ返信します。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ClusterScript.html#onreceive',
};

const deltaTimeBlock = {
  type: 'jcreatepp_delta_time',
  message0: '経過時間',
  output: 'Number',
  colour: 45,
  tooltip: '前フレームからの経過秒数（「毎フレーム」内でのみ使用可）',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate',
};

const playerBlock = {
  type: 'jcreatepp_player',
  message0: 'プレイヤー',
  output: 'PlayerHandle',
  colour: 45,
  tooltip: 'インタラクトしたプレイヤー（「インタラクト時」内でのみ使用可）',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
};

// ブロック定義をエクスポート
export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  onStart,
  onUpdate,
  onInteract,
  setPositionBlock,
  addPositionBlock,
  setRotationBlock,
  addRotationBlock,
  ifBlock,
  ifElseBlock,
  sequenceBlock,
  waitSecondsBlock,
  waitUntilBlock,
  runForSecondsBlock,
  compareBlock,
  notBlock,
  andBlock,
  orBlock,
  deltaTimeBlock,
  playerBlock,
  randomWarpBlock,
  savePositionBlock,
  loadPositionBlock,
  addForceBlock,
  continuousRotationBlock,
  timedRandomWarpBlock,
  timedMoveReturnBlock,
  setMoveSpeedBlock,
  setJumpSpeedBlock,
  flagBlock,
  setFlagBlock,
  numberVarBlock,
  setNumberVarBlock,
  changeNumberVarBlock,
  arithmeticBlock,
  sendMessageOnceBlock,
  sendMessageToItemOnceBlock,
  replyMessageOnceBlock,
  onGrabStart,
  onGrabEnd,
  onReceive,
  oscillateBlock,
  rideTemplateBlock,
  chaseTemplateBlock,
]);
