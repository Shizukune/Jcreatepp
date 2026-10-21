# Jcreate++ for Cluster Creator Kit（Unity エディタ拡張・試作 0.1.0）

Jcreate++ の「JS保存」で保存した `.js` を、Unity でオブジェクトに設定するためのエディタ拡張です。
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

## 使い方

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

## ファイル

| ファイル | 中身 |
|---|---|
| `Editor/Jcreatepp.Editor.asmdef` | エディタ専用のアセンブリ（ビルドに含まれない）。CCK の `ClusterVR.CreatorKit.Item.Implements` を参照 |
| `Editor/JcreateppWindow.cs` | メニューとウィンドウ |
| `Editor/ItemSetup.cs` | コンポーネントを付ける処理（Undo 対応） |
| `Editor/SetupChecks.cs` | 手で設定するものの確認（何も変更しない） |
| `Editor/ScriptAnalysis.cs` | スクリプトの読み取り |
