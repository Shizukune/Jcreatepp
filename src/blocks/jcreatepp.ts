/**
 * Jcreate++ custom Blockly blocks.
 */

import * as Blockly from 'blockly/core';

const onStart = {
  type: 'jcreatepp_on_start',
  message0: '開始時 %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'アイテムが出現したときに1回だけ実行します。',
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
  tooltip: 'フレームごとに繰り返し実行します。',
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
  tooltip: 'プレイヤーがアイテムを使ったときに実行します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
  hat: 'cap',
};

const onCollide = {
  type: 'jcreatepp_on_collide',
  message0: '衝突したとき %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'このアイテムが他のオブジェクトと衝突したときに実行します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oncollide',
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
  tooltip: 'プレイヤーがアイテムを持った瞬間に実行します。',
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
  tooltip: 'プレイヤーがアイテムを離した瞬間に実行します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#ongrab',
  hat: 'cap',
};

const onReceive = {
  type: 'jcreatepp_on_receive',
  message0: 'メッセージ %1 を受け取ったとき %2 %3',
  args0: [
    { type: 'field_input', name: 'MESSAGE', text: 'open' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: '指定したメッセージを受け取ったときに実行します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
  hat: 'cap',
};

const setPositionBlock = {
  type: 'jcreatepp_set_position',
  message0: '位置を x:%1 y:%2 z:%3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムを指定した絶対座標へ移動します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const addPositionBlock = {
  type: 'jcreatepp_add_position',
  message0: '位置を x:%1 y:%2 z:%3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在位置から指定量だけ相対移動します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const setRotationBlock = {
  type: 'jcreatepp_set_rotation',
  message0: '角度を x:%1 y:%2 z:%3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムの角度を指定した角度にします。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

const addRotationBlock = {
  type: 'jcreatepp_add_rotation',
  message0: '角度を x:%1 y:%2 z:%3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の角度から指定量だけ相対回転します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

const randomWarpBlock = {
  type: 'jcreatepp_random_warp',
  message0: '現在位置から範囲 X:%1 Z:%2 へランダム移動する',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在位置を中心に、指定したX/Z範囲内のランダムな位置へ移動します。',
  helpUrl: '',
};

const savePositionBlock = {
  type: 'jcreatepp_save_position',
  message0: '今の位置を保存する',
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在位置を保存します。',
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
  message0: '%1 の強さで X:%2 Y:%3 Z:%4 の方向に力を加える',
  args0: [
    { type: 'input_value', name: 'POWER', check: 'Number' },
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '指定方向へ瞬間的な物理力を加えます。',
  helpUrl: '',
};

const oscillateBlock = {
  type: 'jcreatepp_oscillate',
  message0: '%1 方向に 幅 %2 速さ %3 で往復する',
  args0: [
    {
      type: 'field_dropdown',
      name: 'AXIS',
      options: [
        ['左右(X)', 'X'],
        ['上下(Y)', 'Y'],
        ['前後(Z)', 'Z'],
      ],
    },
    { type: 'input_value', name: 'WIDTH', check: 'Number' },
    { type: 'input_value', name: 'SPEED', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '初期位置を基準にサイン波で往復します。毎フレーム内で使います。',
  helpUrl: '',
};

const continuousRotationBlock = {
  type: 'jcreatepp_continuous_rotation',
  message0: '%1 軸を 速度 %2 で回転し続ける',
  args0: [
    {
      type: 'field_dropdown',
      name: 'AXIS',
      options: [['X', 'X'], ['Y', 'Y'], ['Z', 'Z']],
    },
    { type: 'input_value', name: 'SPEED', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '指定軸を中心に毎フレーム回転します。毎フレーム内で使います。',
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
  tooltip: '現在位置を中心に、指定秒ごとにXZ範囲内へランダム移動します。毎フレーム内で使います。',
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
  tooltip: '初期位置を記録し、指定方向へ一定時間移動したあと元の位置に戻ります。毎フレーム内で使います。',
  helpUrl: '',
};

const setMoveSpeedBlock = {
  type: 'jcreatepp_set_move_speed',
  message0: 'プレイヤーの移動速度倍率を %1 にする',
  args0: [{ type: 'input_value', name: 'RATE', check: 'Number' }],
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'インタラクト時、持ったとき、離したときにプレイヤーの移動速度倍率を変更します。',
  helpUrl: 'https://docs.cluster.mu/script/classes/PlayerHandle.html#setmovespeedrate',
};

const setJumpSpeedBlock = {
  type: 'jcreatepp_set_jump_speed',
  message0: 'プレイヤーのジャンプ速度倍率を %1 にする',
  args0: [{ type: 'input_value', name: 'RATE', check: 'Number' }],
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'インタラクト時、持ったとき、離したときにプレイヤーのジャンプ速度倍率を変更します。',
  helpUrl: 'https://docs.cluster.mu/script/classes/PlayerHandle.html#setjumpspeedrate',
};

const rideTemplateBlock = {
  type: 'jcreatepp_ride_template',
  message0: '乗り物ギミック %1 前進速度:%2 上下速度:%3 旋回速度:%4',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_value', name: 'FORWARD_SPEED', check: 'Number' },
    { type: 'input_value', name: 'UP_DOWN_SPEED', check: 'Number' },
    { type: 'input_value', name: 'TURN_SPEED', check: 'Number' },
  ],
  colour: 0,
  tooltip: '置くだけで乗り物操作を生成するテンプレートです。',
  helpUrl: '',
  hat: 'cap',
};

const chaseTemplateBlock = {
  type: 'jcreatepp_chase_template',
  message0: '追いかけるギミック %1 速度:%2 最大距離:%3 最小距離:%4',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_value', name: 'MOVE_SPEED', check: 'Number' },
    { type: 'input_value', name: 'MAX_DISTANCE', check: 'Number' },
    { type: 'input_value', name: 'MIN_DISTANCE', check: 'Number' },
  ],
  colour: 0,
  tooltip: '近くのプレイヤーへ向きを合わせ、一定距離まで追いかけるテンプレートです。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#getplayersnear',
  hat: 'cap',
};

const ifBlock = {
  type: 'jcreatepp_if',
  message0: 'もし %1 なら %2 %3',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件がtrueのときだけ中のブロックを実行します。',
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
    { type: 'input_statement', name: 'ELSE' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件がtrueなら上、falseなら下のブロックを実行します。',
  helpUrl: '',
};

const ifEdgeBlock = {
  type: 'jcreatepp_if_edge',
  message0: 'もし %1 になった瞬間だけ実行 %2 %3',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件がfalseからtrueになった瞬間だけ、中のブロックを1回実行します。',
  helpUrl: '',
};

const sequenceBlock = {
  type: 'jcreatepp_sequence',
  message0: '一連の動作（完了まで待つ） %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '中に入れた待機ブロックを順番に実行します。',
  helpUrl: '',
};

const waitSecondsBlock = {
  type: 'jcreatepp_wait_seconds',
  message0: '%1 秒待つ',
  args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '指定秒数だけ待機します。一連の動作の中で使います。',
  helpUrl: '',
};

const waitUntilBlock = {
  type: 'jcreatepp_wait_until',
  message0: '%1 まで待つ',
  args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '条件がtrueになるまで待機します。一連の動作の中で使います。',
  helpUrl: '',
};

const runForSecondsBlock = {
  type: 'jcreatepp_run_for_seconds',
  message0: '%1 秒間、毎フレーム実行する %2 %3',
  args0: [
    { type: 'input_value', name: 'SECONDS', check: 'Number' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 280,
  tooltip: '指定秒数の間、中のブロックを毎フレーム実行します。一連の動作の中で使います。',
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
      options: [['=', 'EQ'], ['!=', 'NEQ'], ['<', 'LT'], ['<=', 'LTE'], ['>', 'GT'], ['>=', 'GTE']],
    },
    { type: 'input_value', name: 'B', check: 'Number' },
  ],
  output: 'Boolean',
  colour: 210,
  inputsInline: true,
  tooltip: '2つの数値を比較して真偽値を返します。',
  helpUrl: '',
};

const notBlock = {
  type: 'jcreatepp_not',
  message0: '%1 ではない',
  args0: [{ type: 'input_value', name: 'BOOL', check: 'Boolean' }],
  output: 'Boolean',
  colour: 210,
  tooltip: '真偽値を反転します。',
  helpUrl: '',
};

const andBlock = {
  type: 'jcreatepp_and',
  message0: '%1 かつ %2',
  args0: [
    { type: 'input_value', name: 'A', check: 'Boolean' },
    { type: 'input_value', name: 'B', check: 'Boolean' },
  ],
  inputsInline: true,
  output: 'Boolean',
  colour: 210,
  tooltip: '両方の条件がtrueかどうかを返します。',
  helpUrl: '',
};

const orBlock = {
  type: 'jcreatepp_or',
  message0: '%1 または %2',
  args0: [
    { type: 'input_value', name: 'A', check: 'Boolean' },
    { type: 'input_value', name: 'B', check: 'Boolean' },
  ],
  inputsInline: true,
  output: 'Boolean',
  colour: 210,
  tooltip: 'どちらかの条件がtrueかどうかを返します。',
  helpUrl: '',
};

const flagBlock = {
  type: 'jcreatepp_flag',
  message0: 'フラグ %1',
  args0: [{ type: 'field_input', name: 'FLAG_NAME', text: '名前' }],
  output: 'Boolean',
  colour: 330,
  tooltip: '指定した名前のフラグを読み取ります。',
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
      options: [['true', 'true'], ['false', 'false'], ['切り替える', 'toggle']],
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定したフラグの値を変更します。',
  helpUrl: '',
};

const numberVarBlock = {
  type: 'jcreatepp_number_var',
  message0: '数値変数 %1',
  args0: [{ type: 'field_input', name: 'VAR_NAME', text: 'score' }],
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
    { type: 'input_value', name: 'VALUE', check: 'Number' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した数値変数に値を入れます。',
  helpUrl: '',
};

const changeNumberVarBlock = {
  type: 'jcreatepp_change_number_var',
  message0: '数値変数 %1 を %2 だけ増やす',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'score' },
    { type: 'input_value', name: 'DELTA', check: 'Number' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した数値変数を増減します。負の値なら減ります。',
  helpUrl: '',
};

const stringVarBlock = {
  type: 'jcreatepp_string_var',
  message0: '文字変数 %1',
  args0: [{ type: 'field_input', name: 'VAR_NAME', text: 'name' }],
  output: 'String',
  colour: 330,
  tooltip: '指定した名前の文字変数を読み取ります。',
  helpUrl: '',
};

const setStringVarBlock = {
  type: 'jcreatepp_set_string_var',
  message0: '文字変数 %1 を %2 にする',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'name' },
    { type: 'input_value', name: 'VALUE', check: 'String' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した文字変数に値を入れます。',
  helpUrl: '',
};

const boolVarBlock = {
  type: 'jcreatepp_bool_var',
  message0: '真偽値変数 %1',
  args0: [{ type: 'field_input', name: 'VAR_NAME', text: 'ok' }],
  output: 'Boolean',
  colour: 330,
  tooltip: '指定した名前の真偽値変数を読み取ります。',
  helpUrl: '',
};

const setBoolVarBlock = {
  type: 'jcreatepp_set_bool_var',
  message0: '真偽値変数 %1 を %2 にする',
  args0: [
    { type: 'field_input', name: 'VAR_NAME', text: 'ok' },
    { type: 'input_value', name: 'VALUE', check: 'Boolean' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: '指定した真偽値変数に値を入れます。',
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
      options: [['+', 'ADD'], ['-', 'SUB'], ['*', 'MUL'], ['/', 'DIV']],
    },
    { type: 'input_value', name: 'B', check: 'Number' },
  ],
  output: 'Number',
  colour: 230,
  inputsInline: true,
  tooltip: '2つの数値を計算します。',
  helpUrl: '',
};

const randomNumberBlock = {
  type: 'jcreatepp_random_number',
  message0: '%1 から %2 までのランダム数 %3',
  args0: [
    { type: 'input_value', name: 'MIN', check: 'Number' },
    { type: 'input_value', name: 'MAX', check: 'Number' },
    {
      type: 'field_dropdown',
      name: 'MODE',
      options: [['小数', 'float'], ['整数', 'integer']],
    },
  ],
  output: 'Number',
  colour: 230,
  inputsInline: true,
  tooltip: '指定した範囲のランダムな数値を返します。',
  helpUrl: '',
};

const cooldownActiveBlock = {
  type: 'jcreatepp_cooldown_active',
  message0: 'クールダウン %1 中',
  args0: [{ type: 'field_input', name: 'COOLDOWN_NAME', text: 'action' }],
  output: 'Boolean',
  colour: 330,
  tooltip: '指定したクールダウンが残っているかを返します。',
  helpUrl: '',
};

const cooldownRemainingBlock = {
  type: 'jcreatepp_cooldown_remaining',
  message0: 'クールダウン %1 の残り秒数',
  args0: [{ type: 'field_input', name: 'COOLDOWN_NAME', text: 'action' }],
  output: 'Number',
  colour: 330,
  tooltip: '指定したクールダウンの残り秒数を返します。',
  helpUrl: '',
};

const startCooldownBlock = {
  type: 'jcreatepp_start_cooldown',
  message0: 'クールダウン %1 を %2 秒で開始する',
  args0: [
    { type: 'field_input', name: 'COOLDOWN_NAME', text: 'action' },
    { type: 'input_value', name: 'SECONDS', check: 'Number' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  inputsInline: true,
  tooltip: '指定した名前のクールダウンを開始します。',
  helpUrl: '',
};

const messageValueNumberBlock = {
  type: 'jcreatepp_message_value_number',
  message0: '受け取った数値',
  output: 'Number',
  colour: 20,
  tooltip: 'メッセージ受信イベントで受け取った値を数値として使います。数値でなければ0になります。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
};

const messageValueStringBlock = {
  type: 'jcreatepp_message_value_string',
  message0: '受け取った文字',
  output: 'String',
  colour: 20,
  tooltip: 'メッセージ受信イベントで受け取った値を文字として使います。文字でなければ空文字になります。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
};

const stringLiteralBlock = {
  type: 'jcreatepp_string_literal',
  message0: '文字 %1',
  args0: [{ type: 'field_input', name: 'TEXT', text: 'value' }],
  output: 'String',
  colour: 20,
  tooltip: 'メッセージや文字変数に使う文字を入力します。',
  helpUrl: '',
};

const messageValueBooleanBlock = {
  type: 'jcreatepp_message_value_boolean',
  message0: '受け取った真偽値',
  output: 'Boolean',
  colour: 20,
  tooltip: 'メッセージ受信イベントで受け取った値を真偽値として使います。真偽値でなければfalseになります。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
};

const collisionTargetBlock = {
  type: 'jcreatepp_collision_target',
  message0: '衝突相手',
  output: 'Handle',
  colour: 45,
  tooltip: '衝突イベントで、衝突した相手のハンドルを返します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/Collision.html',
};

const sendMessageOnceBlock = {
  type: 'jcreatepp_send_message_once',
  message0: 'もし %1 になったら 範囲 %2 m のアイテムに メッセージ %3 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_value', name: 'RANGE', check: 'Number' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件がfalseからtrueになった瞬間だけ、近くのアイテムへメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const sendMessageValueOnceBlock = {
  type: 'jcreatepp_send_message_value_once',
  message0: 'もし %1 になったら 範囲 %2 m のアイテムに メッセージ %3 と %4 値 %5 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_value', name: 'RANGE', check: 'Number' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' },
    {
      type: 'field_dropdown',
      name: 'VALUE_TYPE',
      options: [['数値', 'number'], ['文字', 'string'], ['真偽値', 'boolean']],
    },
    { type: 'input_value', name: 'VALUE' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件がfalseからtrueになった瞬間だけ、近くのアイテムへ値つきメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const sendMessageToItemOnceBlock = {
  type: 'jcreatepp_send_message_to_item_once',
  message0: 'もし %1 になったら 指定アイテム %2 に メッセージ %3 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'ITEM_NAME', text: 'door' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件がfalseからtrueになった瞬間だけ、World Item Referenceの指定アイテムへメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const sendMessageValueToItemOnceBlock = {
  type: 'jcreatepp_send_message_value_to_item_once',
  message0: 'もし %1 になったら 指定アイテム %2 に メッセージ %3 と %4 値 %5 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'ITEM_NAME', text: 'door' },
    { type: 'field_input', name: 'MESSAGE', text: 'open' },
    {
      type: 'field_dropdown',
      name: 'VALUE_TYPE',
      options: [['数値', 'number'], ['文字', 'string'], ['真偽値', 'boolean']],
    },
    { type: 'input_value', name: 'VALUE' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '条件がfalseからtrueになった瞬間だけ、指定アイテムへ値つきメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/classes/ItemHandle.html#send',
};

const replyMessageOnceBlock = {
  type: 'jcreatepp_reply_message_once',
  message0: 'もし %1 になったら 送ってきた相手に メッセージ %2 を返す',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'MESSAGE', text: 'ok' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: 'メッセージ受信イベントの中で、送信元へ返信します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
};

const replyMessageValueOnceBlock = {
  type: 'jcreatepp_reply_message_value_once',
  message0: 'もし %1 になったら 送ってきた相手に メッセージ %2 と %3 値 %4 を返す',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'MESSAGE', text: 'ok' },
    {
      type: 'field_dropdown',
      name: 'VALUE_TYPE',
      options: [['数値', 'number'], ['文字', 'string'], ['真偽値', 'boolean']],
    },
    { type: 'input_value', name: 'VALUE' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: 'メッセージ受信イベントの中で、送信元へ値つきメッセージを返します。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive',
};

const sendMessageToCollisionOnceBlock = {
  type: 'jcreatepp_send_message_to_collision_once',
  message0: 'もし %1 になったら 衝突相手に メッセージ %2 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'MESSAGE', text: 'hit' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '衝突イベントの中で、衝突相手へメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/Collision.html',
};

const sendMessageValueToCollisionOnceBlock = {
  type: 'jcreatepp_send_message_value_to_collision_once',
  message0: 'もし %1 になったら 衝突相手に メッセージ %2 と %3 値 %4 を1回だけ送る',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'field_input', name: 'MESSAGE', text: 'hit' },
    {
      type: 'field_dropdown',
      name: 'VALUE_TYPE',
      options: [['数値', 'number'], ['文字', 'string'], ['真偽値', 'boolean'], ['ハンドル', 'handle']],
    },
    { type: 'input_value', name: 'VALUE' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  inputsInline: true,
  tooltip: '衝突イベントの中で、衝突相手へ値つきメッセージを送ります。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/Collision.html',
};

const deltaTimeBlock = {
  type: 'jcreatepp_delta_time',
  message0: '経過時間',
  output: 'Number',
  colour: 45,
  tooltip: '前フレームからの経過秒数です。毎フレーム内で使います。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate',
};

const playerBlock = {
  type: 'jcreatepp_player',
  message0: 'プレイヤー',
  output: 'PlayerHandle',
  colour: 45,
  tooltip: 'イベントに関わったプレイヤーです。インタラクト/持つ/離すイベント内で使います。',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
};

export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  onStart,
  onUpdate,
  onInteract,
  onCollide,
  setPositionBlock,
  addPositionBlock,
  setRotationBlock,
  addRotationBlock,
  ifBlock,
  ifElseBlock,
  ifEdgeBlock,
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
  stringVarBlock,
  setStringVarBlock,
  boolVarBlock,
  setBoolVarBlock,
  randomNumberBlock,
  cooldownActiveBlock,
  cooldownRemainingBlock,
  startCooldownBlock,
  arithmeticBlock,
  sendMessageOnceBlock,
  sendMessageValueOnceBlock,
  sendMessageToItemOnceBlock,
  sendMessageValueToItemOnceBlock,
  replyMessageOnceBlock,
  replyMessageValueOnceBlock,
  sendMessageToCollisionOnceBlock,
  sendMessageValueToCollisionOnceBlock,
  messageValueNumberBlock,
  messageValueStringBlock,
  stringLiteralBlock,
  messageValueBooleanBlock,
  collisionTargetBlock,
  onGrabStart,
  onGrabEnd,
  onReceive,
  oscillateBlock,
  rideTemplateBlock,
  chaseTemplateBlock,
]);
