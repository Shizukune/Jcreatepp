/**
 * Jcreate++ MVP ツールボックス定義
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
          type: 'jcreatepp_on_interact',
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
      ],
    },
  ],
};
