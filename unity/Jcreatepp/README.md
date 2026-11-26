# Jcreate++ for Cluster Creator Kit（Unity エディタ拡張・試作 0.2.0）

Jcreate++ の「JS保存（Unity用）」で保存した `.js` を、Unity で**プレビュー**したり、オブジェクトに**設定**したりするエディタ拡張です。
メニュー **Jcreate++** から使います。

> 試作です。主対象は **Unity 6000.2.6f2 + Unity 6 対応の Cluster Creator Kit** です。Unity 6000.2 ではブロックエディターとプレビューの動作を確認していますが、CCK のすべての版との組み合わせを検証したものではありません。
> 動かなかったら、Console に出たエラーをそのまま教えてください。
>
> ダウンロード: [Jcreatepp-unity.zip](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip)（このフォルダだけを ZIP にしたもの。展開して、中の `Jcreatepp` フォルダを下の「入れ方」のとおりに入れます）

## ライセンス

Jcreate++ 本体は [Apache-2.0](LICENSE) です。このフォルダを再配布する場合も `LICENSE` と下記の第三者表記を含めてください。第三者ライブラリの権利とライセンスは各原文のとおりです。

- [Blockly の表記・ライセンス全文](Editor/Core/THIRD-PARTY-NOTICES.md)
- [Jint・Acornima・.NET ライブラリの表記・ライセンス全文](Editor/Preview/Plugins/THIRD-PARTY-NOTICES.md)

## 対応環境

- **主対象**: Unity 6000.2.6f2（[Cluster 公式の推奨版](https://docs.cluster.mu/creatorkit/installation/install-unity/)）と、Unity 6 対応の Cluster Creator Kit。CCK は [公式の更新手順](https://docs.cluster.mu/creatorkit/installation/update-creatorkit/)に従って導入してください。
- **確認済みの範囲**: Unity 6000.2 でのブロックエディターとプレビュー。Cluster にアップロードした後のすべての動作を保証するものではありません。
- **Unity 2021.3**: この拡張では未検証・動作保証対象外です。パッケージの最低 Unity バージョンも主対象に合わせています。Cluster 公式では Unity 2021.3.4f1 は CCK 3.3.0 までの対応で、現在はサポートが終了しています。「Unity 2021.3 + CCK 3.4」は対応環境として案内しません（[公式の移行手順](https://docs.cluster.mu/creatorkit/installation/update-unity/)）。

拡張内のプレビューはシミュレーターです。生成した JavaScript は、必要なコンポーネントを設定し、最後に Cluster へアップロードして確かめてください。Unity の版の違いだけでスクリプトの動作が変わると断定せず、生成 JS・CCK・コンポーネント設定・物理などを切り分けて確認します。

## 入れ方（どちらか）

**[Unity拡張ZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip)**して展開し、中の`Jcreatepp`フォルダを使います。UnityとCCK自体は別途用意してください。実機確認用サンプルは別の **[実機確認キットZIP](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-realdevice.zip)** です（[キットの使い方](https://github.com/Shizukune/Jcreatepp/blob/main/test/realdevice/README.md)）。

更新するときはプロジェクトをバックアップし、既存の`Assets/Jcreatepp`を置き換えてください。Package Managerで導入済みの場合はAssetsにもコピーせず、既存のパッケージを更新します。旧版と新版を二重に入れないでください。

**A. Assets にコピーする（かんたん）**

1. このフォルダ `Jcreatepp` を、Unity プロジェクトの `Assets` の中にまるごとコピーする
   - 例: `MyProject/Assets/Jcreatepp/Editor/…`
2. Unity に戻ると自動で読み込まれ、上のメニューに **Jcreate++** が出ます

**B. Package Manager から入れる**

1. Unity の `Window > Package Manager` を開く
2. 左上の `＋` → `Add package from disk...` → このフォルダの `package.json` を選ぶ

どちらも、プロジェクトに **Cluster Creator Kit が入っている**必要があります（CCK のクラスを使うため）。

## ブロックエディター（Jcreate++ > ブロックエディター）

Web 版と同じブロックを、Unity のウィンドウの中で組み立てて、そのままプレビュー・オブジェクトへの設定までできます。
ブロックの形・変換・警告・コードは Web 版と同じ処理で作ります。

1. ヒエラルキーで対象を選び、**Jcreate++ > 選んだオブジェクトに動きを作る** を開く。セットアップ画面からも進めます（最初の読み込みには少し時間がかかります）。
2. **テンプレート｜まずここから** でブロックの見本を見て **この動きを追加** を押す。最初は **クリックで上に動く** を試します。他のカテゴリのブロックも真ん中へドラッグして足せます。
   - まず「イベント」の **開始時**・**インタラクト時** などを置き、その中に動作のブロックをつなげます
   - ブロックを近づけると、つながる場所が白く光ります。型が合わない所（数値の所に真偽値など）にはつながりません
   - 白い枠は数字や文字を入力、▾ は選択。ブロックを途中に入れると、下のブロックはそのまま続きます
3. 右に、変換の結果（変換できないところ・警告）とできたコードが出ます。警告の「見る」でそのブロックへ移動します
4. **③ 動きを試す**: 保存せずに右側で動きを試せます。初期設定では、ブロックを編集するとプレビューも最初からやり直します。
5. 右上の対象を確認して **④ 保存して「○○」に設定**: 初回に保存先と名前を1回選ぶと、同名の `.json` と `.js` を作り、必要なコンポーネントも設定します（設定は Ctrl+Z で戻せます）。シーンを Ctrl+S で保存し、最後は Cluster で動作を確認します。

- 動かす: ドラッグ（下につながったブロックも一緒に動きます） / 削除: 選んで Delete、またはパレットの上で離す / 右クリック: 複製・削除
- 画面の移動: 何もない所をドラッグ、またはホイール（Shift+ホイールで横） / 元に戻す: Ctrl+Z、やり直す: Ctrl+Y
- **途中保存** は、未完成のブロックも編集用 JSON に残します。JSON は Web 版や Project ウィンドウのダブルクリックでも開けます。
- **ファイルだけ保存する...** は、対象に設定せず JSON と JS を一緒に保存します。**書き出した JavaScript を開く** はコードエディターを開く操作です。
- **テンプレート｜まずここから** には、完成例5種類と、回転・往復・ドアなどの動きがあります。ブロックの見本を見て選べます。
- **自分で組むためのひな形** を開くと、条件付きなど6種類の組み方も選べます。**ここに動作を置く** に動作を足します。空欄がある作品は途中保存でき、実行・設定には空欄を埋める必要があります。
- 同じ対象を選んで **選んだオブジェクトに動きを作る** を開くと、設定済み JS の隣にある同名 JSON から再編集できます。JS だけからの逆変換ではありません。
- **まだできないこと**: 拡大・縮小、コメント、複数選択、ブロックのコピー＆貼り付け（複製は右クリック）、変数ブロックの一覧表示

## プレビュー（Jcreate++ > プレビュー）

スクリプトを、ウィンドウの中の立方体で動かして見られます。**シーンのオブジェクトにも Play モードにも触れません。**

1. メニュー **Jcreate++ > プレビュー** を開く
2. 「スクリプト」に `.js`（JavaScript Asset）を入れると、開始時の処理が 1 回動きます
3. **再生** で毎フレームの処理が動きます（一時停止・1コマ・最初から・速さ）
4. 「イベントを起こして試す」のボタンで、インタラクト時などを起こせます（スクリプトにあるイベントだけ出ます）
5. 下の「位置と角度」「変数・フラグ・クールダウン」「ログ」で、中で何が起きたかを確かめられます

- 3D はドラッグで回転、ホイールで拡大・縮小。青い線がアイテムの前（+Z）です
- 動きの計算は Jcreate++（Web）の 3D プレビューと同じです
- 変数は、値が入ったものから表示されます（`.js` にはブロックの情報がないため）
- **再現しないもの**: 物理（力・重力）、ほかのアイテム・プレイヤー、乗り物の操縦、音・文字の表示（音と文字はログに出ます）。最後はワールドにアップロードして確かめてください
- 終わらないくり返しなどで、1 コマの処理が 0.25 秒（読み込みは 2 秒）を超えると、プレビューを止めます（「最初から」でやり直せます）

## セットアップ（使い方）

### いちばん早い方法

1. ヒエラルキーで、スクリプトを付けたいオブジェクト（例: Cube）を選ぶ
2. メニュー **Jcreate++ > .js を選んで、選択中のオブジェクトに設定する...**
3. Jcreate++ で保存した `.js` を選ぶ
   - プロジェクトの外にあるファイルは `Assets/Jcreatepp Scripts/` にコピーされます
4. 自動で設定され、結果がウィンドウに出ます

### ウィンドウで設定する

1. メニュー **Jcreate++ > セットアップ ウィンドウを開く**
2. 「1. スクリプト」に `.js`（JavaScript Asset）を入れる（「ファイルから選ぶ...」でも可）
3. 「2. 設定するオブジェクト」は、ヒエラルキーで選んだものが自動で入ります
4. 「3. このオブジェクトに設定する」を押す

## 自動で付けるもの

スクリプトの中身を読んで、必要なものだけ付けます。**既にあるコンポーネントは消しません**。全部 1 回の Ctrl+Z で元に戻せます。

| スクリプトの中身 | 付けるもの |
|---|---|
| いつも | Item、Scriptable Item（Source Code Asset にスクリプトを設定） |
| 位置・角度を変える | Movable Item（Rigidbody の Is Kinematic をオン） |
| 衝突・力を加える（位置は変えない） | Movable Item（Is Kinematic オフ・Use Gravity オン = 物理で動く） |
| つかむイベント | Grabbable Item（と Movable Item） |
| 乗り物ギミック | Ridable Item と、座る位置の子オブジェクト「Seat」 |

つかむイベントと乗り物の両方があるときは、どちらも付けません（Cluster では同じアイテムに併用できないため）。

## 手で設定するもの（ウィンドウの「確認」に出ます）

- **Collider**: クリック・つかむ・乗る・衝突に必要
- **サブノード**: スクリプトが使う名前の子オブジェクト（文字なら TextView も）
- **音**: Item Audio Set List に、スクリプトと同じ ID で音を登録
- **ほかのアイテムへの送信**: World Item Reference List に、同じ ID で相手を登録（ワールド専用）
- **乗り物**: 「Seat」の位置と向きを、座らせたい場所に合わせる

## 注意

- **Scriptable Item はワールドのプレビューでは動きません**。確かめるときはワールドをアップロードしてください
- `.js` を上書きすると、Unity が読み込み直して、設定したアイテムにも反映されます（もう一度設定しなくてよい）
- スクリプトの読み取りは Jcreate++ が作った書き方に合わせた簡単なものです。手書きのスクリプトでは見落とすことがあります

## 困ったとき

- **Console に「Multiple precompiled assemblies with the same name」などの重複エラーが出る**
  - プロジェクトのほかの場所に、同じ名前の DLL（特に `System.Runtime.CompilerServices.Unsafe.dll`）があります
  - `Jcreatepp/Editor/Preview/Plugins/` の同じ名前の DLL を消してみてください（消したら、その旨を教えてください。バージョンの組み合わせを調べます）
- **プレビューの 3D が真っ黒・真っ白**: 描画の方式（Built-in 以外）の違いかもしれません。Console の内容と一緒に教えてください
- **テスト**: `Window > General > Test Runner` の EditMode で `Jcreatepp.Editor.Preview.Tests` を実行すると、同梱の Jint とシミュレーター・ブロック処理がこの Unity で動くかを確かめられます。`CoreHostTests.TimesInThisUnity` は、ブロック処理の時間を Console に出します（結果を教えてください）

## 同梱しているライブラリ

プレビューは、JavaScript を動かすために次のライブラリを同梱しています（`Editor/Preview/Plugins/`、エディタ専用でビルドには入りません）。ライセンス全文は同じフォルダの `THIRD-PARTY-NOTICES.md` にあります。

- Jint 4.17.0（BSD-2-Clause）
- Acornima 1.7.0（BSD-3-Clause）
- System.Runtime.CompilerServices.Unsafe 6.0.0（MIT）

ブロック処理（`Editor/Core/jcreatepp-core.txt`）には、Jcreate++ の Web 版が使っている Blockly を含めています。ライセンス全文は `Editor/Core/THIRD-PARTY-NOTICES.md` にあります。

- Blockly 12.5.1（Apache-2.0、Copyright Google LLC）

## ファイル

| ファイル | 中身 |
|---|---|
| `Editor/Jcreatepp.Editor.asmdef` | エディタ専用のアセンブリ（ビルドに含まれない）。CCK の `ClusterVR.CreatorKit.Item.Implements` を参照 |
| `Editor/JcreateppWindow.cs` | メニューとウィンドウ |
| `Editor/ItemSetup.cs` | コンポーネントを付ける処理（Undo 対応） |
| `Editor/SetupChecks.cs` | 手で設定するものの確認（何も変更しない） |
| `Editor/ScriptAnalysis.cs` | スクリプトの読み取り |
| `Editor/Preview/Jcreatepp.Editor.Preview.asmdef` | プレビュー用のアセンブリ（同梱 DLL だけを明示的に参照） |
| `Editor/Preview/PreviewWindow.cs` | プレビューのウィンドウ |
| `Editor/Preview/PreviewStage.cs` | ウィンドウの中の 3D 表示（PreviewRenderUtility。シーンには何も作らない） |
| `Editor/Preview/SimHost.cs` | Jint でシミュレーターを動かす |
| `Editor/Preview/Sim/jcreatepp-sim.txt` | シミュレーター本体（Jcreate++ の `npm run unity:sim` で作る。拡張子が .txt なのは、.js だと CCK にアイテム用スクリプトとして読み込まれるため） |
| `Editor/Preview/Plugins/` | 同梱ライブラリと、そのライセンス |
| `Editor/Core/Jcreatepp.Editor.Core.asmdef` | ブロック処理用のアセンブリ（同梱 DLL だけを明示的に参照） |
| `Editor/Core/CoreHost.cs` | Jint でブロック処理を動かす（保存したブロックの `.json` → 変換エラー・警告・コード・必要な設定・部品、ブロックエディター用のパレットとブロックの形） |
| `Editor/Core/Json.cs` | JSON の読み書き（Web 版と同じ書き方） |
| `Editor/Blocks/Jcreatepp.Editor.Blocks.asmdef` | ブロックエディターのアセンブリ |
| `Editor/Blocks/BlockEditorWindow.cs` | ブロックエディターのウィンドウ |
| `Editor/Blocks/BlockModel.cs` | 置いたブロック（Blockly の保存形式そのまま）と、つなぐ・外す・削除・複製 |
| `Editor/Blocks/BlockLayout.cs` | ブロックの並べ方、クリックの当たり、つながる場所の判定 |
| `Editor/Blocks/BlockShapes.cs` | ブロックの形とパレット（ブロック処理から読む） |
| `Editor/Blocks/BlockEditorState.cs` | 編集中のブロック（Undo とスクリプトの再読み込み用） |
| `Editor/Core/CoreBundle.cs` | プロジェクトの中からブロック処理本体を探す |
| `Editor/Core/jcreatepp-core.txt` | ブロック処理本体（Web 版と同じ Blockly・変換・コード生成・部品を 1 つにまとめたもの。`npm run unity:sim` で作る） |
| `Editor/Core/THIRD-PARTY-NOTICES.md` | Blockly のライセンス |
| `Tests/Editor/` | EditMode テスト |
