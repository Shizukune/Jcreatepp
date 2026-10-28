# Jcreate++ for Cluster Creator Kit（Unity エディタ拡張・試作 0.2.0）

Jcreate++ の「JS保存」で保存した `.js` を、Unity で**プレビュー**したり、オブジェクトに**設定**したりするエディタ拡張です。
メニュー **Jcreate++** から使います。

> 試作です。Unity 2021.3 + Cluster Creator Kit 3.4 向けに書いていますが、作者の環境ではまだ Unity 上で動かしていません。
> 動かなかったら、Console に出たエラーをそのまま教えてください。

## 入れ方（どちらか）

**A. Assets にコピーする（かんたん）**

1. このフォルダ `Jcreatepp` を、Unity プロジェクトの `Assets` の中にまるごとコピーする
   - 例: `MyProject/Assets/Jcreatepp/Editor/…`
2. Unity に戻ると自動で読み込まれ、上のメニューに **Jcreate++** が出ます

**B. Package Manager から入れる**

1. Unity の `Window > Package Manager` を開く
2. 左上の `＋` → `Add package from disk...` → このフォルダの `package.json` を選ぶ

どちらも、プロジェクトに **Cluster Creator Kit が入っている**必要があります（CCK のクラスを使うため）。

## プレビュー（Jcreate++ > プレビュー）

スクリプトを、ウィンドウの中の立方体で動かして見られます。**シーンのオブジェクトにも Play モードにも触れません。**

1. メニュー **Jcreate++ > プレビュー** を開く
2. 「① スクリプトを選ぶ」に `.js`（JavaScript Asset）を入れる → 開始時の処理が 1 回動きます
3. 「② 再生する」の **再生** で毎フレームの処理が動きます（一時停止・1コマ・最初から・速さ）
4. 「③ イベントを起こして試す」のボタンで、インタラクト時などを起こせます（スクリプトにあるイベントだけ出ます）
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
| `Editor/Core/CoreHost.cs` | Jint でブロック処理を動かす（保存したブロックの `.json` → 変換エラー・警告・コード・必要な設定・部品）。まだ画面からは使っていない（次の版で使う） |
| `Editor/Core/CoreBundle.cs` | プロジェクトの中からブロック処理本体を探す |
| `Editor/Core/jcreatepp-core.txt` | ブロック処理本体（Web 版と同じ Blockly・変換・コード生成・部品を 1 つにまとめたもの。`npm run unity:sim` で作る） |
| `Editor/Core/THIRD-PARTY-NOTICES.md` | Blockly のライセンス |
| `Tests/Editor/` | EditMode テスト |
