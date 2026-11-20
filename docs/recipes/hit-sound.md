# 当たり音つき的あて

## 何ができる？

何かが当たったときに音を鳴らし、文字や見た目を変えます。

衝突、音、文字表示を組み合わせることで、当たったことが分かりやすい的を作れます。

## 使う場面

- 的あて
- ゴール判定
- 当たり判定つきボタン
- ぶつかると反応するオブジェクト

## 必要なUnity / Cluster設定

- スクリプトを動かすアイテムに `Item` と `Scriptable Item` を付け、Scriptable Item に `.js` を設定します（[はじめて Unity で動かす](../first-unity)）。
- `Movable Item` を付け、`Rigidbody` の `Is Kinematic` をオフ、`Use Gravity` をオンにします。この例では的自身を物理で動かし、床や壁に落として衝突を試します。
- 的に `Box Collider` などの衝突判定を付けます。床や壁にも `Collider` が必要です。動かない的に別の物を当てるだけでは、この手順の衝突イベントを確認できません（[onCollide の条件](https://docs.cluster.mu/script/interfaces/ClusterScript.html#onCollide)）。
- 音を鳴らす場合は、Item Audio Set Listに `hit` などのIDで音を登録します。
- 文字を変える場合は、サブノードにTextMeshProなどを付けます。

## Jcreate++で置くブロック

1. `衝突したとき`
2. `音 hit を 音量 1 で鳴らす`
3. `サブノード Text の TextMeshPro の文字を HIT にする`
4. 必要なら `フラグ hit を true にする`

## 生成される考え方

衝突イベントが起きたタイミングで、音を再生し、表示文字を書き換えます。

状態を残したい場合は、フラグや数値変数に保存します。

## 応用

- 衝突相手へ `hit` メッセージを送る
- スコア変数を増やす
- MeshRendererをfalseにして的を消す
- クールダウンで連続ヒットを防ぐ

## よくあるミス

- Item Audio Set ListのIDが違う
- Textサブノード名が違う
- 衝突設定がなく、イベントが発生していない
- 的に `Movable Item` が付いていない、または `Is Kinematic` がオンで、的自身が物理で動いていない
- 同じ瞬間に何度も衝突して音が連続再生される
