/**
 * Jcreate++ toolbox definition.
 */

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'イベント｜開始/毎F/受信',
      colour: '45',
      contents: [
        { kind: 'block', type: 'jcreatepp_on_start' },
        { kind: 'block', type: 'jcreatepp_on_update' },
        { kind: 'block', type: 'jcreatepp_delta_time' },
        { kind: 'block', type: 'jcreatepp_on_interact' },
        { kind: 'block', type: 'jcreatepp_on_collide' },
        { kind: 'block', type: 'jcreatepp_on_grab_start' },
        { kind: 'block', type: 'jcreatepp_on_grab_end' },
        { kind: 'block', type: 'jcreatepp_on_receive' },
        { kind: 'block', type: 'jcreatepp_player' },
        {
          kind: 'block',
          type: 'jcreatepp_players_near_count',
          inputs: { RANGE: { shadow: { type: 'math_number', fields: { NUM: 5 } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_players_near',
          inputs: { RANGE: { shadow: { type: 'math_number', fields: { NUM: 5 } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_raycast_forward',
          inputs: { DISTANCE: { shadow: { type: 'math_number', fields: { NUM: 3 } } } },
        },
      ],
    },
    {
      kind: 'category',
      name: '制御｜if/once/待機',
      colour: '120',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_if',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_flag', fields: { FLAG_NAME: '名前' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_if_else',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_flag', fields: { FLAG_NAME: '名前' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_if_edge',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_flag', fields: { FLAG_NAME: 'open' } } } },
        },
        { kind: 'label', text: '時間・待機' },
        { kind: 'block', type: 'jcreatepp_sequence' },
        {
          kind: 'block',
          type: 'jcreatepp_wait_seconds',
          inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'block', type: 'jcreatepp_wait_until' },
        {
          kind: 'block',
          type: 'jcreatepp_run_for_seconds',
          inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
      ],
    },
    {
      kind: 'category',
      name: '動作｜移動/回転/力',
      colour: '210',
      contents: [
        { kind: 'label', text: '絶対指定' },
        {
          kind: 'block',
          type: 'jcreatepp_set_position',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_rotation',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        { kind: 'label', text: '相対指定' },
        {
          kind: 'block',
          type: 'jcreatepp_add_position',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_add_rotation',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        { kind: 'label', text: '継続動作' },
        {
          kind: 'block',
          type: 'jcreatepp_oscillate',
          inputs: {
            WIDTH: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_continuous_rotation',
          inputs: { SPEED: { shadow: { type: 'math_number', fields: { NUM: 90 } } } },
        },
        { kind: 'label', text: 'ランダム・時間' },
        {
          kind: 'block',
          type: 'jcreatepp_random_warp',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_timed_random_warp',
          inputs: {
            INTERVAL: { shadow: { type: 'math_number', fields: { NUM: 3 } } },
            RANGE: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_timed_move_return',
          inputs: {
            X: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            DURATION: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
          },
        },
        { kind: 'label', text: 'プレイヤー' },
        {
          kind: 'block',
          type: 'jcreatepp_set_move_speed',
          inputs: { RATE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_jump_speed',
          inputs: { RATE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'label', text: '特殊' },
        { kind: 'block', type: 'jcreatepp_save_position' },
        { kind: 'block', type: 'jcreatepp_load_position' },
        {
          kind: 'block',
          type: 'jcreatepp_add_force',
          inputs: {
            POWER: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
            X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            Y: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
      ],
    },
    {
      kind: 'category',
      name: '変数｜数値/文字/真偽',
      colour: '330',
      contents: [
        { kind: 'label', text: 'フラグ' },
        { kind: 'block', type: 'jcreatepp_flag' },
        { kind: 'block', type: 'jcreatepp_set_flag' },
        { kind: 'label', text: '数値' },
        { kind: 'block', type: 'jcreatepp_number_var' },
        {
          kind: 'block',
          type: 'jcreatepp_set_number_var',
          inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_change_number_var',
          inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        { kind: 'label', text: '文字' },
        { kind: 'block', type: 'jcreatepp_string_var' },
        {
          kind: 'block',
          type: 'jcreatepp_set_string_var',
          inputs: { VALUE: { shadow: { type: 'jcreatepp_string_literal', fields: { TEXT: '' } } } },
        },
        { kind: 'label', text: '真偽値' },
        { kind: 'block', type: 'jcreatepp_bool_literal' },
        { kind: 'block', type: 'jcreatepp_bool_var' },
        {
          kind: 'block',
          type: 'jcreatepp_set_bool_var',
          inputs: { VALUE: { shadow: { type: 'jcreatepp_flag', fields: { FLAG_NAME: 'open' } } } },
        },
        { kind: 'label', text: 'クールダウン' },
        { kind: 'block', type: 'jcreatepp_cooldown_active' },
        { kind: 'block', type: 'jcreatepp_cooldown_remaining' },
        {
          kind: 'block',
          type: 'jcreatepp_start_cooldown',
          inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
      ],
    },
    {
      kind: 'category',
      name: '数値｜計算/乱数',
      colour: '230',
      contents: [
        { kind: 'label', text: '値・計算' },
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        {
          kind: 'block',
          type: 'jcreatepp_arithmetic',
          inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            B: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_random_number',
          inputs: {
            MIN: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            MAX: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
      ],
    },
    {
      kind: 'category',
      name: '条件・通信｜送受信/衝突',
      colour: '210',
      contents: [
        { kind: 'label', text: '条件' },
        { kind: 'block', type: 'jcreatepp_flag' },
        { kind: 'block', type: 'jcreatepp_compare' },
        { kind: 'block', type: 'jcreatepp_not' },
        { kind: 'block', type: 'jcreatepp_and' },
        { kind: 'block', type: 'jcreatepp_or' },
        { kind: 'label', text: '送信' },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_once',
          inputs: {
            CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } },
            RANGE: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_value_once',
          inputs: {
            CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } },
            RANGE: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
            VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_to_item_once',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_value_to_item_once',
          inputs: {
            CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } },
            VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_reply_message_once',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_reply_message_value_once',
          inputs: {
            CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } },
            VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_to_collision_once',
          inputs: { CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_send_message_value_to_collision_once',
          inputs: {
            CONDITION: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } },
            VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        { kind: 'label', text: '受信値・ハンドル' },
        { kind: 'block', type: 'jcreatepp_string_literal' },
        { kind: 'block', type: 'jcreatepp_message_value_number' },
        { kind: 'block', type: 'jcreatepp_message_value_string' },
        { kind: 'block', type: 'jcreatepp_message_value_boolean' },
        { kind: 'block', type: 'jcreatepp_collision_target' },
      ],
    },
    {
      kind: 'category',
      name: '演出｜音/文字/表示',
      colour: '20',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_play_audio',
          inputs: { VOLUME: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_subnode_text',
          inputs: { TEXT: { shadow: { type: 'jcreatepp_string_literal', fields: { TEXT: 'Hello' } } } },
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_component_enabled',
          inputs: { ENABLED: { shadow: { type: 'jcreatepp_bool_literal', fields: { VALUE: 'true' } } } },
        },
      ],
    },
    {
      kind: 'category',
      name: '完成済み｜乗り物/追跡',
      colour: '0',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_ride_template',
          inputs: {
            FORWARD_SPEED: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
            UP_DOWN_SPEED: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
            TURN_SPEED: { shadow: { type: 'math_number', fields: { NUM: 90 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_chase_template',
          inputs: {
            MOVE_SPEED: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
            MAX_DISTANCE: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
            MIN_DISTANCE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
      ],
    },
  ],
};
