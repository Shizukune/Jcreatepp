---
layout: home

hero:
  name: Jcreate++
  text: はじめてのスクリプトを、ブロックで
  tagline: Unity に Jcreate++ を入れて、クリックで動く箱を作り、Cluster のワールドで試してみましょう。
  actions:
    - theme: brand
      text: Unity に入れて作る
      link: /first-unity
    - theme: alt
      text: ブラウザで見てみる
      link: /app/
---

<script setup>
import { withBase } from 'vitepress'
</script>

## スクリプトって何？

スクリプトは、**「いつ、何をするか」をコンピューターに伝える指示**です。たとえば「箱がクリックされたら、今いる場所から 1 m 上に動かす」という指示があれば、クリックするたびに箱が動きます。

Cluster のワールドでアイテムにこうした指示を出す仕組みが **Cluster Script** です。Jcreate++ では、「クリックされたとき」と「上に動かす」にあたるブロックをつなぐと、Cluster が読める JavaScript（コード）が自動でできます。

## 作った仕掛けが動くところ

スイッチを操作すると、離れたドアが開閉します。Jcreate++ で作った[遠隔ドアのレシピ](/recipes/remote-door)の動作例です。

<video controls muted playsinline preload="none" width="720" :src="withBase('/images/recipes/remote-door-demo.mp4')" aria-label="遠隔スイッチでドアが開閉する動作例"></video>

## Unity で最初の仕掛けを作る {#first-project}

[Unity 入門ガイド](/first-unity)では、Jcreate++ を導入し、Unity の中でブロックを組んでプレビューします。最初は、クリックするたびに 1 m 上がる箱を作ります。

## 次に作るものを選ぶ

- [サイコロ判定](/recipes/dice-judge) で、出た数字によって動きを変える
- [クールダウンつきボタン](/recipes/cooldown) で、連打してもすぐには動かないようにする
- [遠隔スイッチで開くドア](/recipes/remote-door) で、スイッチとドアを連動させる

ほかの作例は [レシピ一覧](/recipes/) にあります。使い方が分からないブロックは [ブロックの使い方](/reference/) で調べられます。
