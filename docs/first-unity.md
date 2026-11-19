# はじめて Unity で動かす

ブラウザで作った「クリックすると 1 m 上がる箱」を、今度は Cluster のワールドで動かします。まだブロックを作っていない人は、[最初の仕掛けを作る](/#first-project) から始めてください。

## 0. 準備（最初の 1 回だけ）

Cluster のワールドは Unity で作ります。Unity と、Cluster 用の機能を追加する Cluster Creator Kit を入れます。Unity 拡張の導入は、後で自動設定を使う場合に選べます。

1. [Unity の導入](https://docs.cluster.mu/creatorkit/installation/install-unity/)（Cluster 公式）
2. [Creator Kit の導入](https://docs.cluster.mu/creatorkit/installation/install-creatorkit/)（Cluster 公式）

Unity は Cluster 公式が案内しているバージョンを使います。最初は Creator Kit のテンプレートプロジェクトを使うと、アップロードに必要なワールド設定がそろっています。動かすアイテムには、足場の上に置いた Cube を使います。

このガイドと Jcreate++ の Unity 拡張の主対象は **Unity 6000.2.6f2 + Unity 6 対応の Creator Kit** です。Unity 拡張は Unity 6000.2 でブロックエディターとプレビューの動作を確認しています。Unity 2021.3 は拡張の未検証・動作保証対象外です。Cluster 公式でも Unity 2021.3.4f1 は CCK 3.3.0 までの対応で、現在はサポートが終了しています。古いプロジェクトはバックアップしてから [公式の Unity 移行手順](https://docs.cluster.mu/creatorkit/installation/update-unity/)を確認してください。

## 1. ブラウザからスクリプトを保存する

1. [Jcreate++ を開き](/app/)、箱を動かすブロックを表示します。上に動かす量（y）は **1** にします。
2. 右側の **3Dプレビュー** で **インタラクト** を押し、箱が 1 m 上に動くことを確かめます。
3. 上の **JS保存（Unity用）** を押して、`.js` ファイルを保存します。通常はブラウザのダウンロードフォルダに入ります。

右側の「Unity側で必要な設定」に出ている内容は、あとで使うのでメモしておきます。

## 2. Unity でアイテムに付ける

Unity では、ヒエラルキーがシーン内の物の一覧で、Inspector が選んだ物の設定欄です。最初は **A** の手順で、Cube に動作を設定してみましょう。Unity 拡張を試したい場合は **B** に進みます。

### A. 手で付ける

1. 保存した `.js` を、Unity の `Project` ウィンドウの `Assets` にドラッグ&ドロップする
2. ヒエラルキーで、動かしたいオブジェクト（例: Cube）を選ぶ
3. Inspector の `Add Component` で、下の表のコンポーネントを付ける
4. `Scriptable Item` の `Source Code Asset` に、入れた `.js` を設定する

今回の Cube には **Item・Scriptable Item・Movable Item** を付け、**Rigidbody > Is Kinematic** をオンにします。クリックに必要な **Box Collider** は、Unity の Cube に最初から付いています。

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

`.js` を選ぶと、`Item` と `Scriptable Item` を設定し、位置を変える例では `Movable Item` を付けて `Is Kinematic` をオンにします。Unity の中で動きをプレビューすることもできます。

1. [Jcreate++ Unity 拡張（ZIP）](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip) をダウンロードして展開する
2. 中の `Jcreatepp` フォルダを、Unity プロジェクトの `Assets` にまるごとコピーする
3. Unity の上のメニューに **Jcreate++** が出たら、Cube を選んで **Jcreate++ > .js を選んで、選択中のオブジェクトに設定する...** を選び、保存した `.js` を開く
4. Cube の Inspector で `Box Collider` が付いていることを確認する。`Collider` は手動設定で、Unity の Cube には最初から `Box Collider` が付いています。

試作なので、うまく動かないときは Console に出たメッセージを教えてください。

### 用意済みのサンプルで実機確認したい場合

**[実機確認キットZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-realdevice.zip)**してください。展開した`realdevice/scripts`フォルダをUnityの`Assets`へコピーし、`realdevice/README.md`と`CHECKLIST.md`を読みます。最初は`rd1-position-immediate.js`をCubeに設定し、Clusterへアップロードしてクリックすると1 m上がることを確かめます。

このキットはテスト用のJS・ブロックJSON・手順書です。Unity拡張は含まれません。自動設定も使う場合は、上のUnity拡張ZIPも導入してください。ZIP自体やソース一式の`Jcreatepp-main`全体をUnityへ入れる必要はありません。

## 3. Cluster にアップロードして確かめる

Scriptable Item は、Unity の再生（Play）では動きません。動きは Cluster にアップロードして確かめます。

1. Cube を配置したシーンを開き、Unity の **Cluster > ワールドアップロード** を選ぶ。
2. 初回は **ワールド > 新規作成** を選び、対象のワールドにアップロードする。
3. [ワールド管理画面](https://cluster.mu/account/worlds) からワールドに入り、Cube をクリックする。クリックするたびに Cube が 1 m 上に動けば成功です。

アップロードしたワールドには、公開するまでは作者だけが入れます。詳しい操作は [ワールドの作成とアップロード](https://docs.cluster.mu/creatorkit/world/upload/)（Cluster 公式）を参照してください。

動かないときは、[動かないときの確認リスト](./troubleshooting) を見てください。

## もっと知りたいとき

- [Scriptable Item コンポーネント](https://docs.cluster.mu/creatorkit/item-components/scriptable-item/)（Cluster 公式）
- [Cluster Script の最低限のルール](./cluster-rules)
