# はじめて Unity で動かす

Jcreate++ で作った JS を、Cluster のワールドで動かすまでの全体の流れです。
はじめての人は、このページを上から順に進めてください。

## 0. 準備（最初の 1 回だけ）

Cluster のワールドは Unity で作ります。Unity と、Cluster 用の道具（Cluster Creator Kit）を入れます。

1. [Unity の導入](https://docs.cluster.mu/creatorkit/installation/install-unity/)（Cluster 公式）
2. [Creator Kit の導入](https://docs.cluster.mu/creatorkit/installation/install-creatorkit/)（Cluster 公式）

どちらも公式の手順どおりに進めれば大丈夫です。Unity のバージョンは公式に書かれているものを使ってください。

## 1. Jcreate++ で JS を作る

1. [Jcreate++ を開く](/app/)
2. ブロックを置く（最初は [触ったら動く](./recipes/interact-move) がおすすめです）
3. 右側の `3Dプレビュー` で動きを確かめる（[3Dプレビュー](./preview)）
4. 上の `JS保存（Unity用）` を押して、`.js` ファイルを保存する

右側の「Unity側で必要な設定」に出ている内容は、あとで使うのでメモしておきます。

## 2. Unity でアイテムに付ける

方法は 2 つあります。

### A. 手で付ける

1. 保存した `.js` を、Unity の `Project` ウィンドウの `Assets` にドラッグ&ドロップする
2. ヒエラルキーで、動かしたいオブジェクト（例: Cube）を選ぶ
3. Inspector の `Add Component` で、下の表のコンポーネントを付ける
4. `Scriptable Item` の `Source Code Asset` に、入れた `.js` を設定する

| 付けるもの | いつ必要？ |
|---|---|
| `Item` | いつも |
| `Scriptable Item` | いつも（ここに `.js` を設定します） |
| `Movable Item` | 位置や角度を変えるとき（動く・回る・力を加える）。一緒に `Rigidbody` が付きます（下の注意を見てください） |
| `Collider` | インタラクト（クリック・使う）・つかむ・乗る・衝突を使うとき。Cube などには最初から付いています |
| `Grabbable Item` | 「持ったとき / 離したとき」を使うとき |
| `Ridable Item` | 乗り物ギミックを使うとき |

::: warning Movable Item を付けたら Rigidbody を確認
`Movable Item` を付けると `Rigidbody` も付き、そのままだと重力で落ちます。

- ブロックで位置や角度を変えるだけのとき: `Rigidbody` の `Is Kinematic` をオンにする（落ちずにその場にとどまります）
- `力を加える` や衝突で、物理で動かしたいとき: `Is Kinematic` をオフ、`Use Gravity` をオンのままにする

（B の Unity 拡張は、スクリプトの中身に合わせてこの設定も自動で行います）
:::

音・ほかのアイテムへの送信などは、「Unity側で必要な設定」に出た内容を設定します（[JSを保存してUnityに持っていく](./export-to-unity)）。

### B. Jcreate++ の Unity 拡張で自動で付ける（試作）

`.js` を選ぶだけで、上の表のコンポーネントのうち必要なものを自動で付けます。Unity の中で動きをプレビューすることもできます。

1. [Jcreate++ Unity 拡張（ZIP）](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip) をダウンロードして展開する
2. 中の `Jcreatepp` フォルダを、Unity プロジェクトの `Assets` にまるごとコピーする
3. Unity の上のメニューに **Jcreate++** が出たら、オブジェクトを選んで **Jcreate++ > .js を選んで、選択中のオブジェクトに設定する...** を選ぶ

試作なので、うまく動かないときは Console に出たメッセージを教えてください。

## 3. Cluster にアップロードして確かめる

Scriptable Item は、Unity の再生（Play）では動きません。動きは Cluster にアップロードして確かめます。

- [ワールドの作成とアップロード](https://docs.cluster.mu/creatorkit/world/upload/)（Cluster 公式）

動かないときは、[動かないときの確認リスト](./troubleshooting) を見てください。

## もっと知りたいとき

- [Scriptable Item コンポーネント](https://docs.cluster.mu/creatorkit/item-components/scriptable-item/)（Cluster 公式）
- [Cluster Script の最低限のルール](./cluster-rules)
