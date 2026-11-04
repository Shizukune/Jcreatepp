# JSを保存してUnityに持っていく

Jcreate++で作ったブロックは、Cluster Script用のJavaScriptとして保存できます。

ここでは「ブロックを置く → JSを保存する → Unityに入れる → Scriptable Itemに設定する」までを短く説明します。
Unity や Cluster Creator Kit の準備、アップロードまで含めた全体の流れは [はじめて Unity で動かす](./first-unity) を見てください。

## 1. ブロックを置く

Jcreate++の画面左側で、使いたいブロックを置きます。

最初は、次のような小さな構成から始めるのがおすすめです。

- `インタラクト時`
- その中に `位置を x:0 y:1 z:0 ずつ変える`
- または `もし true になったら 指定アイテム door に メッセージ open を1回だけ送る`

いきなり大きな仕掛けを作るより、まず1つ動かす方が原因を見つけやすいです。

## 2. 生成コードを確かめる

ブロックを置くと、右側の「生成コード」にJavaScriptが自動で表示されます。

エラーが出た場合は、ブロックの置き場所や空欄になっている値を確認してください。

## 3. ファイル名を決めてJS保存（Unity用）を押す

画面上部の `JSファイル名` 欄に、保存したいファイル名を入力します。

例:

```text
door_switch.js
```

`.js` を付け忘れても、自動で `.js` が付きます。

そのあと `JS保存（Unity用）` を押します。

保存したファイルは、通常はブラウザのダウンロードフォルダに入ります。

## 4. Unityプロジェクトに入れる

保存した `.js` ファイルを、Unityプロジェクトの `Assets` 内にドラッグ&ドロップします。

例:

```text
Assets/Scripts/door_switch.js
```

フォルダ名は自由ですが、あとで探しやすい場所に置くのがおすすめです。

## 5. アイテムにScriptable Itemを付ける

Unity上で、スクリプトを動かしたいアイテムを選びます。

Inspectorで、Cluster用の `Item` と `Scriptable Item` コンポーネントを追加します。位置や角度を変えるスクリプトなら `Movable Item` も付けます（[付けるものの一覧](./first-unity#_2-unity-でアイテムに付ける)）。

すでに付いている場合は、追加しなくて大丈夫です。

## 6. Scriptable ItemにJSをアタッチする

Scriptable Itemの `Source Code Asset` 欄に、保存した `.js` ファイルを設定します。

設定したら、Clusterへアップロードして実際に動くか確認します。

## 7. Unity側設定も確認する

Jcreate++の右側に「Unity側で必要な設定」が表示される場合があります。

例:

- `指定アイテム door に メッセージ open を1回だけ送る` → World Item Reference List に `door` を登録する
- `音 hit を 音量 1 で鳴らす` → Item Audio Set List に `hit` を登録する
- `サブノード Text の TextView の文字を … にする` → `Text` という名前の子オブジェクトに TextView を付ける
- 衝突を使う → Collider と、物理で動く Movable Item（Rigidbody の Is Kinematic をオフ）が必要

生成したJSだけでは完結しないギミックもあるので、この表示も確認してください。

## よくあるミス

- `JS保存（Unity用）` の `.js` ではなく、`ブロック保存` の `.json` をUnityに入れている
- Scriptable Itemが付いていない
- Scriptable ItemにJSファイルを設定していない
- 別アイテム参照や音など、Unity側の追加設定を忘れている
- ファイルを保存したあと、古いJSをUnity側で使い続けている

迷ったら、まずは「触ったらメッセージを送る」くらいの小さいScriptで動作確認するのがおすすめです。
