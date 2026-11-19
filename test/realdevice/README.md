# 実機確認キット

## ダウンロードして始める

**[実機確認キットZIPをダウンロード](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-realdevice.zip)** → ZIPを展開 → この`README.md` → [CHECKLIST.md](./CHECKLIST.md)の順に進めてください。ファイルを1つずつGitHubから保存する必要はありません。

Unity内で自動設定・プレビューも使う場合は、別に **[Unity拡張ZIP](https://shizukune.github.io/Jcreatepp/downloads/Jcreatepp-unity.zip)** をダウンロードし、展開した`Jcreatepp`フォルダを`Assets`へ入れます。すでに入っている人は再導入不要です。キットと拡張は別のものです。

必要な環境は **Unity 6000.2.6f2 + Unity 6対応Cluster Creator Kit** です。UnityとCCKはこのキットには含まれません（[準備の説明](https://shizukune.github.io/Jcreatepp/first-unity)）。Node.jsやnpmは、用意済みのファイルを試すだけなら不要です。

### 展開したもののうち、何をUnityへ入れる？

| 中身 | 使い方 |
|---|---|
| **`realdevice/scripts/`フォルダ** | Unityの`Assets`へコピーします。中の`.js`が実際に動かすスクリプトです |
| `realdevice/CHECKLIST.md` | 手順と期待する動きを読むためのファイルです。Unityへ入れなくて構いません |
| `realdevice/rdN-….json` | ブロックの中身を見たいときにWeb版／Unityブロックエディターで開きます。Scriptable Itemへ設定するファイルではありません |

最初はCubeを1つ作り、[rd1](./CHECKLIST.md#rd1-位置の即時反映)の手順で`rd1-position-immediate.js`を設定してください。ワールドをClusterへアップロードし、クリックすると1 m上がれば成功です。そのあとrd9・rd17・rd18を確かめると、回転・移動の組み合わせを確認できます。

ZIPを展開しただけではテスト用シーンは作られません。シナリオごとにCubeとコンポーネントを用意します。`.unitypackage`ではないため、ZIP自体をUnityへインポートする必要はありません。

リンクが開けないときは[ソース一式ZIP](https://github.com/Shizukune/Jcreatepp/archive/refs/heads/main.zip)から`test/realdevice`を取り出してください。配布用キットZIPには、下の開発用`.ts`ファイルは含めていません。

Jcreate++ の動作テストは、Cluster の動きをまねたモック（`src/sim/`）の上で動いています。
ここにあるシナリオは、**モックでは確かめられないことを Cluster の実機で確かめる**ためのものです。
期待する結果は `test/realdevice.test.ts` でモックと照合済みなので、実機で違う結果が出たら、モックか生成コードの前提が実機と違うということです。

## 手順書

**[CHECKLIST.md](./CHECKLIST.md) を見てください。**
シナリオごとに、使うスクリプト・Unity の準備・操作・期待する結果・違ったときに分かることがまとめてあります。

- rd1〜rd8: Jcreate++ が前提にしている細かい動き（位置の即時反映、小数、待機の時間、向き など）
- rd9〜rd18: よく使う機能（回転・往復、ドア、メッセージの送受信、音と文字、つかむ、衝突、近くのプレイヤー、追いかける、位置と向きの足し合わせ）

## ファイル

| ファイル | 中身 |
|---|---|
| `CHECKLIST.md` | 手順書（一覧表に結果を書き込めます） |
| `scripts/rdN-….js` | 生成済みの Cluster Script。Unity の Assets にコピーして、Scriptable Item の Source Code Asset に入れる |
| `rdN-….json` | 同じシナリオのブロック（Jcreate++ の `ブロックを開く` で中身を見られる） |
| `scenarios.ts` | シナリオの正本（ブロック・操作・期待する結果） |
| `kit.ts` / `export.ts` | 上の 3 種類のファイルを作るスクリプト |

ファイル名の `rdN-名前` は、スクリプト・ブロック・手順書の見出しですべて同じです。

## シナリオを変えるとき

ここからはソース一式を使う開発者向けです。実機で試すだけなら実行不要です。

1. `scenarios.ts` を編集する
2. `npm run realdevice:export` を実行する（JSON・スクリプト・手順書がまとめて作り直されます）
3. 期待する結果を `test/realdevice.test.ts` に書く

ファイルが古いままだと `npm test` が失敗するので、作り直し忘れに気づけます。
生成コードの書き方が変わったときも、スクリプトを作り直してください。
