# Jcreate++

Jcreate++は、Cluster ScriptをBlocklyベースのスクラッチ風UIで作成するためのプロトタイプツールです。

まず試すだけなら、ダウンロードやターミナル操作は不要です。ブラウザでWeb版を開くだけで使えます。

## すぐ使う

Web版はこちらです。

[Jcreate++を開く](https://shizukune.github.io/Jcreatepp/app/)

使い方の説明とレシピ集はこちらです。

[Jcreate++ はじめてガイド](https://shizukune.github.io/Jcreatepp/)

## 何ができる？

- ブロックを組み合わせてCluster Script用のJavaScriptを作る
- 触ったとき、毎フレーム、移動、回転、ランダム、クールダウンなどの基本処理を作る
- 作ったScriptを `.js` ファイルとして保存する
- 保存した `.js` をUnityプロジェクトに入れて、Scriptable Itemに設定する

## 使い方の流れ

1. [Jcreate++を開く](https://shizukune.github.io/Jcreatepp/app/)
2. ブロックを置く
3. `JS生成` を押す
4. `JS名` にファイル名を入れる
5. `JS保存` を押して `.js` ファイルを保存する
6. 保存した `.js` をUnityプロジェクトの `Assets` に入れる
7. 動かしたいアイテムに `Scriptable Item` を付ける
8. Scriptable Itemに `.js` ファイルを設定する
9. Clusterへアップロードして動作確認する

詳しい手順は、こちらにまとめています。

[JSを保存してUnityに持っていく](https://shizukune.github.io/Jcreatepp/export-to-unity)

## 初心者向けレシピ

まずは小さいギミックから試すのがおすすめです。

- [触ったら動く](https://shizukune.github.io/Jcreatepp/recipes/interact-move)
- [サイコロ判定](https://shizukune.github.io/Jcreatepp/recipes/dice-judge)
- [クールダウンつきボタン](https://shizukune.github.io/Jcreatepp/recipes/cooldown)

## ダウンロードして使いたい場合

通常はWeb版を使えばOKです。

ソースコードを手元に置きたい場合だけ、GitHubからダウンロードしてください。

1. 緑色の `Code` ボタンを押す
2. `Download ZIP` を押す
3. ZIPファイルを展開する

ZIPでダウンロードした場合、フォルダ名が `Jcreatepp-main` のようになることがあります。

これはGitHubの仕様です。そのまま使って大丈夫です。気になる場合は、フォルダ名を `Jcreatepp` に変更しても問題ありません。

## 開発したい人向け

Jcreate++自体を手元で動かしたり改造したりする場合は、Node.jsが必要です。

### 必要なもの

- [Node.js](https://nodejs.org/)
- npm（Node.jsを入れると一緒に入ります）

確認:

```bash
node -v
npm -v
```

### 起動

```bash
npm install
npm run start
```

ブラウザが自動で開かない場合は、次のURLを開いてください。

```text
http://localhost:8080/
```

または:

```text
http://127.0.0.1:8080/
```

### ビルド

```bash
npm run build
```

### ドキュメント

```bash
npm run docs:dev
npm run docs:build
npm run docs:preview
```

## よくあるつまずき

### `npm` が見つからない

Node.jsが入っていない、またはインストール後にターミナルを開き直していない可能性があります。

Node.jsを入れたあと、PowerShellやターミナルを一度閉じてから開き直してください。

### ブラウザでWeb版が開けない

GitHub Pagesへの反映直後は、公開まで少し時間がかかることがあります。

少し待ってから、もう一度開いてください。

### Unityで動かない

まず次を確認してください。

- `.js` ファイルをUnityプロジェクトの `Assets` に入れているか
- 動かしたいアイテムに `Scriptable Item` が付いているか
- Scriptable Itemに `.js` ファイルを設定しているか
- Jcreate++の「Unity側で必要な設定」に出ている項目を設定したか

## 注意

Jcreate++はプロトタイプです。

ClusterやCluster Scriptの仕様は更新される可能性があります。公開ワールドで使う前に、生成されたScriptとUnity側の設定を実機で確認してください。

## ライセンス

Apache-2.0
