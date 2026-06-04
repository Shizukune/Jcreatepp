/**
 * Jcreate++ ツールボックス定義
 * カテゴリ: イベント / 動作 / 数値
 */

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'イベント',
      colour: '45',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_on_start',
        },
        {
          kind: 'block',
          type: 'jcreatepp_on_update',
        },
        {
          kind: 'block',
          type: 'jcreatepp_delta_time',
        },
        {
          kind: 'block',
          type: 'jcreatepp_on_interact',
        },
        {
          kind: 'block',
          type: 'jcreatepp_on_grab_start',
        },
        {
          kind: 'block',
          type: 'jcreatepp_on_grab_end',
        },
        {
          kind: 'block',
          type: 'jcreatepp_on_receive',
        },
        {
          kind: 'block',
          type: 'jcreatepp_player',
        },
      ],
    },
    {
      kind: 'category',
      name: '制御',
      colour: '120',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_if',
          inputs: {
            CONDITION: {
              shadow: {
                type: 'jcreatepp_flag',
                fields: {
                  FLAG_NAME: '名前',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_if_else',
          inputs: {
            CONDITION: {
              shadow: {
                type: 'jcreatepp_flag',
                fields: {
                  FLAG_NAME: '名前',
                },
              },
            },
          },
        },
        {
          kind: 'label',
          text: '時間・待機',
        },
        {
          kind: 'block',
          type: 'jcreatepp_sequence',
        },
        {
          kind: 'block',
          type: 'jcreatepp_wait_seconds',
          inputs: {
            SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_wait_until',
        },
      ],
    },
    {
      kind: 'category',
      name: '動作',
      colour: '210',
      contents: [
        {
          kind: 'label',
          text: '絶対（〜にする）',
        },
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
        {
          kind: 'label',
          text: '相対（〜ずつ変える）',
        },
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
        {
          kind: 'label',
          text: '継続動作',
        },
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
          inputs: {
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 90 } } },
          },
        },
        {
          kind: 'label',
          text: 'ランダム・時間',
        },
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
        {
          kind: 'label',
          text: 'プレイヤー',
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_move_speed',
          inputs: {
            RATE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_jump_speed',
          inputs: {
            RATE: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
        {
          kind: 'label',
          text: '特殊',
        },
        {
          kind: 'block',
          type: 'jcreatepp_save_position',
        },
        {
          kind: 'block',
          type: 'jcreatepp_load_position',
        },
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
      name: '変数',
      colour: '330',
      contents: [
        {
          kind: 'block',
          type: 'jcreatepp_flag',
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_flag',
        },
        {
          kind: 'block',
          type: 'jcreatepp_number_var',
        },
        {
          kind: 'block',
          type: 'jcreatepp_set_number_var',
          inputs: {
            VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_change_number_var',
          inputs: {
            DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
      ],
    },
    {
      kind: 'category',
      name: '数値',
      colour: '230',
      contents: [
        {
          kind: 'label',
          text: '値（自由入力）',
        },
        {
          kind: 'block',
          type: 'math_number',
          fields: {
            NUM: 0,
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_arithmetic',
          inputs: {
            A: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            B: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          },
        },
      ],
    },
    {
      kind: 'category',
      name: '条件・演算',
      colour: '210',
      contents: [
        {
          kind: 'label',
          text: 'フラグ条件',
        },
        {
          kind: 'block',
          type: 'jcreatepp_flag',
        },
        {
          kind: 'label',
          text: '比較・組み合わせ',
        },
        {
          kind: 'block',
          type: 'jcreatepp_compare',
        },
        {
          kind: 'block',
          type: 'jcreatepp_not',
        },
        {
          kind: 'block',
          type: 'jcreatepp_and',
        },
        {
          kind: 'block',
          type: 'jcreatepp_or',
        },
      ],
    },
    {
      kind: 'category',
      name: '完成済みギミック',
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
