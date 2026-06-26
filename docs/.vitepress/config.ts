export default {
  title: 'Jcreate++ はじめてガイド',
  description: 'Cluster ScriptをBlocklyで作るための初心者向けレシピ集',
  lang: 'ja-JP',
  base: '/jcreatepp/',
  cleanUrls: true,
  ignoreDeadLinks: [/^\/app\//],
  themeConfig: {
    nav: [
      { text: 'Jcreate++を開く', link: '/app/' },
      { text: 'はじめに', link: '/' },
      { text: 'レシピ', link: '/recipes/' },
      { text: 'Unityへ持っていく', link: '/export-to-unity' },
      { text: 'Clusterルール', link: '/cluster-rules' },
      { text: '困ったとき', link: '/troubleshooting' },
    ],
    sidebar: [
      {
        text: 'はじめに',
        items: [
          { text: 'Jcreate++を開く', link: '/app/' },
          { text: 'Jcreate++とは', link: '/' },
        ],
      },
      {
        text: 'レシピ集',
        items: [
          { text: 'レシピ一覧', link: '/recipes/' },
          { text: '触ったら動く', link: '/recipes/interact-move' },
          { text: 'サイコロ判定', link: '/recipes/dice-judge' },
          { text: 'クールダウンつきボタン', link: '/recipes/cooldown' },
        ],
      },
      {
        text: '資料',
        items: [
          { text: 'JSを保存してUnityに持っていく', link: '/export-to-unity' },
          { text: 'Cluster Scriptの最低限のルール', link: '/cluster-rules' },
          { text: 'トラブルシュート', link: '/troubleshooting' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Jcreate++は、Cluster Scriptを学びながら小さなギミックを作るためのプロトタイプです。',
      copyright: 'Released under the Apache-2.0 License.',
    },
  },
};
