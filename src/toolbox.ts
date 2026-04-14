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
          kind: 'block',
          type: 'jcreatepp_move',
          inputs: {
            X: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 0,
                },
              },
            },
            Y: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 1,
                },
              },
            },
            Z: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 0,
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'jcreatepp_rotate',
          inputs: {
            ANGLE: {
              shadow: {
                type: 'math_number',
                fields: {
                  NUM: 90,
                },
              },
            },
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
