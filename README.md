# Jcreate++

Jcreate++は、Cluster ScriptをBlocklyベースのスクラッチ風UIで作成するためのプロトタイプツールです。

ブロックを組み合わせることで、JavaScriptやCluster Scriptに慣れていない人でも、Clusterワールド用の簡単なギミックを試せることを目指しています。

## できること

- ブロックを組み合わせてCluster Scriptを生成する
- インタラクト、毎フレーム処理、移動、回転、ランダム、クールダウンなどの基本処理を作る
- 生成されたScriptを見ながら、Cluster Scriptの考え方を少しずつ学ぶ
- 初心者向けレシピを見ながら、小さなギミックを作る

## 対象者

- Clusterでワールドを作っている人
- Cluster Scriptをこれから学ぶ人
- UnityやJavaScriptにあまり慣れていない人
- 授業やワークショップで簡単なギミックを作りたい人

## まず使ってみる

### 1. 必要なもの

先に以下を入れてください。

- [Node.js](https://nodejs.org/)
- npm（Node.jsを入れると一緒に入ります）
- GitHubからダウンロードしたJcreate++のファイル

Node.jsを入れたあと、ターミナルやPowerShellで次を実行して、バージョンが表示されればOKです。

```bash
node -v
npm -v
```

### 2. ファイルをダウンロードする

GitHubのリポジトリページで、次の順番でダウンロードします。

1. 緑色の `Code` ボタンを押す
2. `Download ZIP` を押す
3. ZIPファイルを展開する
4. 展開したフォルダを開く

ZIPでダウンロードした場合、フォルダ名が `jcreatepp-main` のようになることがあります。

これはGitHubの仕様なので、そのまま使って大丈夫です。気になる場合は、フォルダ名を `jcreatepp` に変更しても問題ありません。

### 3. ターミナルでフォルダを開く

Windowsの場合は、展開したフォルダを開いた状態で、アドレスバーに `powershell` と入力してEnterを押すと、その場所でPowerShellを開けます。

または、PowerShellで次のように移動します。

```bash
cd ダウンロードしたフォルダの場所
```

例:

```bash
cd Downloads/jcreatepp-main
```

### 4. 必要なパッケージを入れる

最初の1回だけ、次を実行します。

```bash
npm install
```

少し時間がかかります。`node_modules` というフォルダが作られれば正常です。

### 5. Jcreate++を起動する

次を実行します。

```bash
npm run start
```

成功すると、ブラウザが自動で開きます。

もし自動で開かない場合は、ブラウザで次のURLを開いてください。

```text
http://localhost:8080/
```

または、環境によっては次のURLで開けます。

```text
http://127.0.0.1:8080/
```

## 作ったScriptをUnity / Clusterに持っていく

Jcreate++でブロックを置いたあと、生成したJavaScriptファイルをUnityのプロジェクトに入れて、Clusterの Scriptable Item に設定します。

### 1. ブロックを置く

Jcreate++の画面左側で、使いたいブロックを置きます。

最初は、`触ったとき` のようなイベントブロックを1つ置き、その中に動作ブロックを入れるのがおすすめです。

### 2. JS生成を押す

画面上部の `JS生成` を押します。

右側の「生成コード」にJavaScriptが表示されれば成功です。

エラーが出た場合は、ブロックの置き場所や、必要な値が空になっていないか確認してください。

### 3. ファイル名を決めてJS保存を押す

画面上部の `JS名` 欄に、保存したいファイル名を入力します。

例:

```text
door_switch.js
```

`.js` を付け忘れても、自動で `.js` が付きます。

そのあと `JS保存` を押します。

保存したファイルは、ブラウザのダウンロードフォルダに入ります。

### 4. Unityプロジェクトに入れる

保存した `.js` ファイルを、UnityプロジェクトのAssets内にドラッグ&ドロップします。

例:

```text
Assets/Scripts/door_switch.js
```

フォルダ名は自由ですが、あとで探しやすい場所に置くのがおすすめです。

### 5. アイテムにScriptable Itemを付ける

Unity上で、スクリプトを動かしたいアイテムを選びます。

Inspectorで、Cluster用の `Scriptable Item` コンポーネントを追加します。

すでに付いている場合は、追加しなくて大丈夫です。

### 6. Scriptable ItemにJSをアタッチする

Scriptable ItemのScript欄に、保存した `.js` ファイルを設定します。

設定できたら、Clusterへアップロードして実際に動くか確認します。

### 7. Unity側設定も確認する

Jcreate++の右側に「Unity側で必要な設定」が表示される場合があります。

例:

- 別アイテムを動かす → World Item Reference が必要
- 音を鳴らす → Audio Set が必要
- マテリアルを変える → Material Set が必要
- 衝突を使う → Collider や衝突設定が必要

生成したJSだけでは完結しないギミックもあるので、この表示も確認してください。

## よくあるつまずき

### `npm` が見つからない

Node.jsが入っていない、またはインストール後にターミナルを開き直していない可能性があります。

Node.jsを入れたあと、PowerShellやターミナルを一度閉じてから開き直してください。

### `npm install` で止まる

通信環境やセキュリティソフトの影響で時間がかかることがあります。

しばらく待っても進まない場合は、ネットワークを確認してください。

### ブラウザで開いても何も出ない

`npm run start` が動いているターミナルを閉じると、開発用サーバーも止まります。

Jcreate++を使っている間は、ターミナルを開いたままにしてください。

### `jcreatepp-main` というフォルダ名で大丈夫？

大丈夫です。

GitHubからZIPでダウンロードすると、ブランチ名が付いたフォルダ名になります。中身は同じなので、そのまま使えます。

## ドキュメント

初心者向けのレシピ集と簡単な説明資料を用意しています。

- [Jcreate++ はじめてガイド](https://shizukune.github.io/jcreatepp/)
- [レシピ集](https://shizukune.github.io/jcreatepp/recipes/)
- [Cluster Scriptの最低限のルール](https://shizukune.github.io/jcreatepp/cluster-rules)
- [トラブルシュート](https://shizukune.github.io/jcreatepp/troubleshooting)

GitHub Pagesに反映されるまでは、リポジトリ内の `docs/` フォルダからも内容を確認できます。

## 開発用コマンド

Jcreate++本体を起動します。

```bash
npm run start
```

本体をビルドします。

```bash
npm run build
```

ドキュメントサイトをローカルで起動します。

```bash
npm run docs:dev
```

ドキュメントサイトをビルドします。

```bash
npm run docs:build
```

## 注意

Jcreate++はプロトタイプです。

ClusterやCluster Scriptの仕様は更新される可能性があります。公開ワールドで使う前に、生成されたScriptとUnity側の設定を実機で確認してください。

## ライセンス

Apache-2.0
