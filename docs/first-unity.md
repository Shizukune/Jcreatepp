# はじめて Unity で動かす

Jcreate++ を Unity に入れて、**クリックするたびに 1 m 上がる箱**を作ります。Unity の中でブロックを組み、動きを確かめてから、Cluster のワールドで試します。

## 1. Unity に Jcreate++ を入れる

Unity はワールドを作るアプリです。Cluster Creator Kit を入れると、そのワールドを Cluster にアップロードできるようになります。

1. [Unity の導入](https://docs.cluster.mu/creatorkit/installation/install-unity/)（Cluster 公式）
2. [Creator Kit の導入](https://docs.cluster.mu/creatorkit/installation/install-creatorkit/)（Cluster 公式）
3. [Jcreate++ Unity 拡張（ZIP）](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip) をダウンロードして展開します。
4. 展開した **Jcreatepp フォルダ**を、Unity プロジェクトの **Assets** に丸ごとコピーします。Unity に戻り、上のメニューに **Jcreate++** が表示されたら準備完了です。

Unity は Cluster 公式が案内しているバージョンを使います。最初は Creator Kit のテンプレートプロジェクトを使うと、アップロードに必要なワールド設定がそろっています。動かすアイテムには、足場の上に置いた Cube を使います。

このガイドと Jcreate++ の Unity 拡張の主対象は **Unity 6000.2.6f2 + Unity 6 対応の Creator Kit** です。Unity 拡張は Unity 6000.2 でブロックエディターとプレビューの動作を確認しています。Unity 2021.3 は拡張の未検証・動作保証対象外です。Cluster 公式でも Unity 2021.3.4f1 は CCK 3.3.0 までの対応で、現在はサポートが終了しています。古いプロジェクトはバックアップしてから [公式の Unity 移行手順](https://docs.cluster.mu/creatorkit/installation/update-unity/)を確認してください。

## 2. ブロックを組んで動かす

1. **GameObject > 3D Object > Cube** で箱を作り、足場の上に置きます。ヒエラルキーで Cube を選び、**Jcreate++ > 選んだオブジェクトに動きを作る** を開きます。セットアップ画面の **テンプレートから動きを作る** からも進めます。
2. 左の **テンプレート｜まずここから** で **クリックで上に動く** のブロック見本を見て、**この動きを追加** を押します。必要なブロックがつながった状態で入ります。
3. **位置を x:0 y:1 z:0 ずつ変える** が入っていることを確認します。y が上下方向です。後から別のタブのブロックを足すこともできます。
4. 右側の **③ 動きを試す** を押し、同じ画面に出る **インタラクト時** を押します。押すたびに箱が 1 m 上がれば成功です。左側のブロックはそのまま編集できます。

ブロックをつなぐと、右側に Cluster が読めるコードが表示されます。y を **2** に変えると、コードの数字も変わり、プレビューでは１回で 2 m 上がります。次に進む前に y を **1** に戻しておきます。

## 3. ワールドの箱に設定する

プレビューの箱で動きを確認できたら、ワールドの中にある箱に同じスクリプトを付けます。

1. 右上の **① 動きを付けるオブジェクト** が Cube になっていることを確認します。別の物を選択しても、編集中の対象は自動では変わりません。
2. **④ 保存して「Cube」に設定** を押します。
3. 初回は **Assets** 内の保存先と名前を1回選びます。同名の実行用 `.js` と編集用 `.json` が保存され、動作に必要な設定が Cube に追加されます。先に JSON を作る必要はありません。
4. Cube の **Box Collider** を確認し、シーンを **Ctrl+S** で保存します。Unity の Cube には最初から Collider が付いています。

続きから編集するときは、Cube を選んで同じメニューを開きます。同名の JSON が残っていればブロックを開けます。JS だけからの逆変換ではないため、JSON も残してください。

## 4. Cluster にアップロードして確かめる

Scriptable Item は、Unity の再生（Play）では動きません。動きは Cluster にアップロードして確かめます。

1. Cube を配置したシーンを開き、Unity の **Cluster > ワールドアップロード** を選ぶ。
2. 初回は **ワールド > 新規作成** を選び、対象のワールドにアップロードする。
3. [ワールド管理画面](https://cluster.mu/account/worlds) からワールドに入り、Cube をクリックする。クリックするたびに Cube が 1 m 上に動けば成功です。

アップロードしたワールドには、公開するまでは作者だけが入れます。詳しい操作は [ワールドの作成とアップロード](https://docs.cluster.mu/creatorkit/world/upload/)（Cluster 公式）を参照してください。

動かないときは、[動かないときの確認リスト](./troubleshooting) を見てください。

## 別の方法で試す

### ブロックやコードをファイルにする

- **ファイルだけ保存する...** は、オブジェクトに設定せず、同名の JS と JSON をまとめて保存します。
- **途中保存** は、未完成のブロックも JSON に残せます。コードを開く場合は **書き出した JavaScript を開く** を使います。

### ブラウザ版で保存した JS を手で設定する場合 {#manual-setup}

::: details 手動設定の手順

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

**Movable Item を付けたら Rigidbody を確認します。**

- ブロックで位置や角度を変えるだけのとき: `Rigidbody` の `Is Kinematic` をオンにする（落ちずにその場にとどまります）
- `力を加える` や衝突で、物理で動かしたいとき: `Is Kinematic` をオフ、`Use Gravity` をオンのままにする

音・ほかのアイテムへの送信などは、「Unity側で必要な設定」に出た内容を設定します（[JSを保存してUnityに持っていく](./export-to-unity)）。
:::

### 用意済みのサンプルで実機確認したい場合

**[実機確認キットZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-realdevice.zip)**してください。展開した`realdevice/scripts`フォルダをUnityの`Assets`へコピーし、`realdevice/README.md`と`CHECKLIST.md`を読みます。最初は`rd1-position-immediate.js`をCubeに設定し、Clusterへアップロードしてクリックすると1 m上がることを確かめます。

このキットはテスト用のJS・ブロックJSON・手順書です。Unity拡張は含まれません。自動設定も使う場合は、上のUnity拡張ZIPも導入してください。ZIP自体やソース一式の`Jcreatepp-main`全体をUnityへ入れる必要はありません。

## もっと知りたいとき

- [Scriptable Item コンポーネント](https://docs.cluster.mu/creatorkit/item-components/scriptable-item/)（Cluster 公式）
- [Cluster Script の最低限のルール](./cluster-rules)
