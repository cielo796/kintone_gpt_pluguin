# 実装仕様：バージョン9（詳細→編集でボタンが消える不具合の修正）

docs/SPEC-v7.md・SPEC-v8.md の続き。**ここに書いた変更だけを行う。**

## 不具合
レコード詳細画面で「レコードを編集する」を押すと、kintone は次の順で処理する（開発環境で実測）。
1. `popstate`（hash は `#record=N&mode=edit`）
2. `app.record.edit.show` → プラグインがパネルを作る
3. `hashchange` → プラグインの `dispose()` がパネルを削除する
結果、編集モードで「AIに問い合わせ」ボタンが表示されない。v6 から存在した不具合。

## 修正
- `window` の `popstate` / `hashchange` では **パネルを削除しない**。送信中の問い合わせがあれば取り消す（`current?.request?.cancel()`）だけにする。
- パネルの片付けは従来どおり、`record.index.show` / `record.detail.show`、および次の `create.show` / `edit.show` 冒頭の `dispose()` で行う。重複表示しないこと。
- 取り消し後のメッセージの扱いは従来の CancelledError と同じ（メッセージを消し、ボタンを元に戻す）。
- それ以外の動作は一切変えない（遅延応答の破棄、`checkCurrent` の URL 比較、保存時取消、pagehide、タイムアウト等）。

## テスト（tests/runtime.test.cjs、PC・モバイル両方）
- edit.show の直後に hashchange と popstate が発生しても、パネルとボタンが残り、押せば問い合わせできる。
- 送信中に hashchange / popstate が発生すると問い合わせは取り消され、回答は反映されず、ボタンは「AIに問い合わせ」に戻って再度押せる。
- detail.show / index.show でパネルが消えること、edit.show を繰り返してもパネルが1つであることは既存テストを維持。
- 既存テストで「hashchange / popstate でパネルが消える」ことを前提にしているものは、上の新しい仕様に合わせて直す。
