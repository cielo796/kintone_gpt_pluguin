# 実装仕様：バージョン8（モデル一覧の差し替え）

docs/SPEC-v7.md の続き。**ここに書いた変更だけを行う。** v7 で作った UI・安全策・リクエスト形式（6.2 系は developer メッセージ）はそのまま。

## 1. 新しいモデル表（設定画面とレコード画面で完全一致）
GPT-5 系（gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna / gpt-5.5）は**削除**し、次の7モデルにする。並び順もこの表のとおり。

| value | 設定画面の表示 | 使える思考の深さ |
|---|---|---|
| `gpt-6.1-sol` | GPT-6.1 Sol | low, medium, high, xhigh, max |
| `gpt-6.2-sol` | GPT-6.2 Sol | low, medium, high, xhigh, max |
| `gpt-6.2-astra` | GPT-6.2 Astra | low, medium, high, xhigh, max |
| `gpt-6.1-terra` | GPT-6.1 Terra | none, low, medium, high, xhigh, max |
| `gpt-6-astra` | GPT-6 Astra | low, medium, high, xhigh, max |
| `gpt-6-sol` | GPT-6 Sol | none, low, medium, high, xhigh, max |
| `gpt-6-luna` | GPT-6 Luna（推奨） | none, low, medium, high, xhigh, max |

- **既定（新規設定の初期値・不明／削除済みモデルのフォールバック）は `gpt-6-luna` / `medium`。** 「推奨」表示は GPT-6 Luna だけに付ける（GPT-6.2 Astra の「（推奨）」は外す）。
- 保存済みの model が GPT-5 系など表にない値なら、設定画面では GPT-6 Luna を選択状態にし、レコード画面でも `gpt-6-luna` として送る。
- effort の正規化ルールは v7 と同じ（minimal→none、none 非対応モデルは none→low、それ以外の不正値・空は medium）。
- developer メッセージ形式は v7 と同じく `gpt-6.2-astra` と `gpt-6.2-sol` だけ。他は `instructions` + 文字列 input。

## 2. 設定画面の文言
- モデルの hint：「GPT-6 Luna は低価格で大量処理向け（推奨）、GPT-6.2 Astra は高度な推論向け、GPT-6.2 Sol は日常業務向けです。保存済みのモデル設定は引き継ぎます。」
- 思考の深さの hint：「Astra・6.1 Sol・6.2 Sol は low〜max、6.1 Terra・6 Sol・6 Luna は none〜max。高いほど時間と費用がかかります。」

## 3. 担当（同時作業・他人のファイルは触らない）
- Codex：`src/js/common.js`、`tests/runtime.test.cjs`、`docs/NOTES-codex.md`（追記）
- OpenCode：`src/html/config.html`、`src/js/config.js`、`tests/config.test.cjs`、`docs/NOTES-opencode.md`（追記）
- Claude：manifest（version 8）、README、ビルド

## 4. テスト
- GPT-5 系の値が選択肢・許可リストから消えていること。保存済み gpt-5.6-terra 等は Luna にフォールバック。
- 新規は gpt-6-luna / medium。Luna・6 Sol・6.1 Terra は none を送れる。6.1 Sol は none/minimal→low。
- 6.2 系は developer 形式、それ以外（6.1 Sol・Luna など）は instructions 形式。
- 既存の v7 テストで GPT-5 系を使っているものは、同じ意図を保ったまま新しい表のモデルに置き換える。
