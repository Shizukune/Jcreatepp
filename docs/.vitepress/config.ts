export default {
  title: 'Jcreate++ はじめてガイド',
  description: 'スクリプトが初めての人向けに、ブロックで小さな仕掛けを作ってClusterで動かすまでを紹介します。',
  lang: 'ja-JP',
  base: '/Jcreatepp/',
  cleanUrls: true,
  ignoreDeadLinks: [/^\/app\//],
  themeConfig: {
    nav: [
      { text: 'Jcreate++を開く', link: '/app/' },
      { text: 'はじめに', link: '/' },
      { text: 'レシピ', link: '/recipes/' },
      { text: 'Unity・Clusterで動かす', link: '/first-unity' },
      {
        text: '調べる',
        items: [
          { text: 'ブロックの使い方', link: '/reference/' },
          { text: 'Cluster Scriptのルール', link: '/cluster-rules' },
          { text: '困ったとき', link: '/troubleshooting' },
          { text: '更新履歴', link: '/changelog' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'はじめに',
        items: [
          { text: 'Jcreate++を開く', link: '/app/' },
          { text: 'スクリプトって何？', link: '/' },
          { text: '3Dプレビュー', link: '/preview' },
          { text: 'はじめて Unity で動かす', link: '/first-unity' },
        ],
      },
      {
        text: 'レシピ集',
        items: [
          { text: 'レシピ一覧', link: '/recipes/' },
          { text: '触ったら動く', link: '/recipes/interact-move' },
          { text: 'サイコロ判定', link: '/recipes/dice-judge' },
          { text: 'クールダウンつきボタン', link: '/recipes/cooldown' },
          { text: '遠隔スイッチで開くドア', link: '/recipes/remote-door' },
          { text: '近づくと点灯するランプ', link: '/recipes/sensor-light' },
          { text: '当たり音つき的あて', link: '/recipes/hit-sound' },
        ],
      },
      {
        text: 'パーツリファレンス',
        items: [
          { text: 'リファレンス一覧', link: '/reference/' },
          { text: 'イベント', link: '/reference/events' },
          { text: '制御と待機', link: '/reference/control' },
          { text: '動作', link: '/reference/motion' },
          { text: '変数と値', link: '/reference/state-values' },
          { text: '通信', link: '/reference/messaging' },
          { text: '演出と検知', link: '/reference/effects-sensors' },
        ],
      },
      {
        text: '資料',
        items: [
          { text: 'JSを保存してUnityに持っていく', link: '/export-to-unity' },
          { text: 'Cluster Scriptの最低限のルール', link: '/cluster-rules' },
          { text: 'トラブルシュート', link: '/troubleshooting' },
          { text: '更新履歴', link: '/changelog' },
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

