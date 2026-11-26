# Jcreate++

Jcreate++ は、ブロックを組んで Cluster のアイテムに動きを付けるツールです。Unity の中で組み立て、同じ画面で動きを試し、選んだアイテムに設定できます。

初めて使う方は [Unity 入門ガイド](https://shizukune.github.io/Jcreatepp/first-unity.html) から始めてください。画面を気軽に試したい場合は [ブラウザ版](https://shizukune.github.io/Jcreatepp/app/) も使えます。

## どれをダウンロードすればいい？

| やりたいこと | 開く・ダウンロードするもの | 次にすること |
|---|---|---|
| ブロックを作って試したい | [Web版を開く](https://shizukune.github.io/Jcreatepp/app/) | インストール不要。そのままブロックを置けます |
| Unityの中でブロック編集・プレビュー・自動設定を使いたい | **[Unity拡張ZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip)** | ZIPを展開し、中の **`Jcreatepp`フォルダを丸ごと** Unityの`Assets`へ入れます |
| Cluster上でサンプルの動作を確認したい | **[実機確認キットZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-realdevice.zip)** | ZIPを展開し、`realdevice/README.md`から始めます。Unityへ入れるのは **`scripts`フォルダ**です |
| Jcreate++自体を開発・改造したい | [開発用ソース一式ZIP](https://github.com/Shizukune/Jcreatepp/archive/refs/heads/main.zip) | 下の「開発したい人向け」を見てください。通常の利用には不要です |

**実機確認をする人は、まず「Unity拡張ZIP」と「実機確認キットZIP」の2つをダウンロードしてください。** Unity拡張がすでに入っている場合は、実機確認キットだけで始められます。拡張を使わず、コンポーネントを手で設定して試すこともできます。

### 実機確認までの最短手順

1. **Unity 6000.2.6f2 + Unity 6対応Cluster Creator Kit**のプロジェクトを用意します（[初めての準備](https://shizukune.github.io/Jcreatepp/first-unity)）。この2つは上のZIPには含まれていません。
2. Unity拡張ZIPを展開し、`Jcreatepp`フォルダを`Assets/Jcreatepp`として入れます。以前の版がある場合は[更新方法](unity/Jcreatepp/README.md#入れ方どちらか)を確認し、二重に入れないでください。
3. 実機確認キットZIPを展開します。`realdevice/scripts`をUnityの`Assets`へコピーします（例：`Assets/Jcreatepp Test Scripts/`）。`README.md`や`.json`をアイテムのSource Code Assetへ入れる必要はありません。
4. まずCubeを1つ作り、[CHECKLISTのrd1](test/realdevice/CHECKLIST.md#rd1-位置の即時反映)の準備をします。Jcreate++のメニューから`rd1-position-immediate.js`を選んで設定すると早いです。Cubeの`Box Collider`も確認します。
5. ワールドをClusterへアップロードして入り、Cubeをクリックします。1 m上がれば成功です。**UnityのPlayボタンでの実行と、Clusterでの実機確認は別です。**
6. 続いて[実機テスト手順書](test/realdevice/CHECKLIST.md)のrd9・rd17・rd18などを進めます。使うJS・必要なコンポーネント・期待する動きがシナリオごとに書かれています。

ZIPのダウンロードリンクが開けないときは、[ソース一式ZIP](https://github.com/Shizukune/Jcreatepp/archive/refs/heads/main.zip)を展開して、Unity拡張は`unity/Jcreatepp`、実機確認キットは`test/realdevice`を取り出してください。**`Jcreatepp-main`全体をUnityのAssetsへ入れないでください。** GitHub Pagesの公開処理中は、ZIPに最新の変更が反映されるまで時間がかかることがあります。

## Unity で作る

1. ヒエラルキーで対象を選び、**Jcreate++ > 選んだオブジェクトに動きを作る** を開きます。セットアップ画面の **テンプレートから動きを作る** からも進めます。
2. 左の **テンプレート｜まずここから** で、ブロックの見本を見て **この動きを追加** を押します。最初は **クリックで上に動く** がおすすめです。
3. **③ 動きを試す** を押して、右側の箱で動きを確かめます。
4. **④ 保存して「オブジェクト名」に設定** を押します。初回に保存先と名前を1回選ぶと、編集用 JSON と実行用 JS が一緒に保存され、必要なコンポーネントも設定されます。シーンを保存し、最後に Cluster で動作を確かめます。

ファイルだけ欲しい場合は **ファイルだけ保存する...** で JSON と JS を一緒に保存できます。作りかけは **途中保存** で残せます。既存の動きに同名の JSON があれば、対象を選んで同じメニューを開くと編集を再開できます。JS だけからブロックへ逆変換する機能はありません。

詳しい操作は [Unity 拡張の説明](unity/Jcreatepp/README.md) にあります。ブラウザ版で作ったコードを持ち込む場合は [JS を保存して Unity に持っていく](https://shizukune.github.io/Jcreatepp/export-to-unity) を参照してください。

## 初心者向けレシピ

まずは小さいギミックから試すのがおすすめです。

- [触ったら動く](https://shizukune.github.io/Jcreatepp/recipes/interact-move)
- [サイコロ判定](https://shizukune.github.io/Jcreatepp/recipes/dice-judge)
- [クールダウンつきボタン](https://shizukune.github.io/Jcreatepp/recipes/cooldown)

## 開発用ソースをダウンロードしたい場合

通常の利用や実機確認には、上のダウンロード表を使ってください。

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

[Apache-2.0](LICENSE)。Unity 拡張にも同じライセンス全文を同梱しています。

利用ライブラリ・フォントの著作権表記とライセンス全文は、[ライセンス・第三者表記](https://shizukune.github.io/Jcreatepp/licenses)を参照してください。Web 版・ガイドの配布物にはビルドに含まれたライブラリの原文を自動で同梱します。第三者のコンポーネントにはそれぞれのライセンスが適用されます。
