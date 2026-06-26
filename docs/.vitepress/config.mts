import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Jcreate++ レシピ集',
  description: 'Cluster Script向けビジュアルブロック Jcreate++ の初心者向けドキュメント',
  base: '/jcreatepp/',
  lang: 'ja-JP',
  cleanUrls: true,
  srcExclude: [
    'control-model-notes.md',
    'design-review.md',
    'implementation-fix-report.md',
    'message-if-design.md',
    'next-feature-design.md',
  ],
  themeConfig: {
    nav: [
      { text: 'レシピ', link: '/recipes/switch-door' },
      { text: 'Clusterルール', link: '/cluster-rules' },
      { text: '困ったとき', link: '/troubleshooting' },
    ],
    sidebar: [
      {
        text: 'はじめに',
        items: [
          { text: 'Jcreate++ レシピ集', link: '/' },
        ],
      },
      {
        text: 'レシピ',
        items: [
          { text: 'スイッチでドアを開ける', link: '/recipes/switch-door' },
          { text: '踏むと1回だけ反応する床', link: '/recipes/collision-pad' },
          { text: 'ランダム宝箱', link: '/recipes/random-chest' },
        ],
      },
      {
        text: '資料',
        items: [
          { text: 'Clusterルール早見表', link: '/cluster-rules' },
          { text: 'トラブルシュート', link: '/troubleshooting' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Jcreate++ は Cluster Script の学習と試作を助けるためのツールです。',
      copyright: 'Released under the Apache-2.0 License.',
    },
  },
});
