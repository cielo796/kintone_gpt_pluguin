# OpenCode 作業メモ（バージョン7 設定画面）

## 変更したファイル

- `src/html/config.html`
- `src/js/config.js`
- `src/css/config.css`
- `tests/config.test.cjs`
- `docs/NOTES-opencode.md`（新規）

`common.js` / `desktop.js` / `mobile.js` / `panel.css` / `manifest.json` / `package.json` / `README.md` / `SPEC-v7.md` は変更していません。git commit もしていません。

## 設定画面（HTML / CSS）

- 5章の構成どおりに作り直しました。`section.kgp-config` → `header.kgp-config-hero` → `form.js-submit-settings` → 基本設定カード → 詳細設定（`details`）→ 操作ボタン、の順です。
- クラス名・文言は 5章の指定に合わせています。必須マークは `span.kgp-config-required`「必須」です。
- モデルの選択肢は 2章の表の順で、GPT-6.2 Astra（推奨）/ GPT-6.2 Sol / GPT-6 Astra / GPT-5.6 Sol / Terra / Luna / GPT-5.5 を追加・並べ替えました。
- 入力フィールド・返信フィールド・ボタンを置くスペースは、手入力の `input` から `select`（`js-content-field` / `js-reply-field` / `js-space-id`）に変更しました。先頭は value="" の「選択してください」です。
- APIキー欄は `type="password"`、`placeholder="sk-..."`、`autocomplete="new-password"` のままです。`js-apikey-state` に「設定済み」/「未設定」を表示します。
- 保存ボタンは `type="submit".js-save-button.kintoneplugin-button-dialog-ok` で、初期状態は `disabled` です。
- `config.css` は 5章の参照値をそのまま使用しました（旧 `settings-*` / `model-summary` 系のスタイルは削除）。

## 設定画面（config.js）

- 2章のモデル表をコード内に持たせ、表示名・並び順・モデルごとの effort 許可リストを HTML と一致させました。
- 新規設定（model 未保存）の初期値は `gpt-6.2-astra` / `medium` です。保存済みの対応モデルは変更しません。不明なモデルは `gpt-6.2-astra` として扱います。
- effort の正規化は仕様どおりです。
  - `minimal` → `none`
  - `none` を使えない 6.2 Astra / 6.2 Sol / 6 Astra では `none` → `low`
  - 許可リストにない値・空は `medium`
- モデル変更時に、使えない effort の選択肢を `disabled` ＋ `hidden` にし、正規化した値を選択します。
- 画面表示時にプレビュー版フォームの fields と layout を取得します（15秒タイムアウト）。
  - 入力候補：トップレベルの `SINGLE_LINE_TEXT` / `MULTI_LINE_TEXT`。表示は「ラベル（コード）」。
  - 返信候補：上と同じ型から、`expression` が空でないもの、`lookup` プロパティを持つもの、`fieldMappings[].field` に含まれるもの（コピー先）を除外。
  - スペース候補：layout の `SPACER` で `elementId` があるもの。GROUP 内も再帰的に探索し、重複を除外。
  - 保存済みの値が候補にない場合は「値（見つかりません）」の option を追加して選択状態にします。
  - 取得後に保存ボタンを有効化します。取得失敗時は `js-form-state` に「フォーム情報を取得できませんでした。画面を再読み込みしてください。」をエラー色で表示し、保存ボタンは無効のままにします。
- 既存の保存処理は維持しています。
  - APIキーは Proxy 設定にだけ保存。
  - Proxy 保存成功後に、キーを含まない通常設定を保存。
  - 旧版の通常設定キー（`config.apikey`）の移行。
  - Proxy 読み込み失敗時は保存しない。
  - 保存前の `validateSettings`。
  - 二重保存防止（`saving` フラグと保存ボタンの無効化）。
  - キャンセルで `../../{app}/plugin/` へ遷移。
- 必須チェックの文言は選択操作に合わせて「選択してください」にしました（APIキーのみ「入力してください」）。

## テスト（tests/config.test.cjs）

- `document` のモックを拡張し、`createElement('option')`、`appendChild`、`replaceChildren`、`options`、`selected`、`classList` に対応しました。
- 既存の移行・保存順序・失敗時のテストは維持しています。
- 追加した設定画面向けテスト：
  - ドロップダウンの入力候補（テーブル内・リッチテキストの除外、ラベル表示）。
  - 返信候補の自動計算・ルックアップ・コピー先の除外。
  - GROUP 内スペースの候補と重複除外。
  - 保存済みの値が見つからない場合の「（見つかりません）」表示。
  - フォーム取得前・取得失敗時は保存できないこと。
  - 新規設定が 6.2 Astra / medium であること。
  - 全モデルの選択肢・表示名と effort 連動・正規化（none / minimal / 空 / 不正値 / max）。
  - GPT-5.5 で max が使えないこと、5.6 Sol の none から 6.2 Astra への切り替え。
  - APIキー状態表示（設定済み / 未設定）。
  - フィールドコード・スペースIDが select であること。
- 結果：`node --test tests/config.test.cjs` は **26件すべて成功**（fail 0）。

## ESLint の確認状況

- 指定の `node node_modules/eslint/bin/eslint.js src/js/config.js` は、この環境では次の理由で実行できませんでした。
  - `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'prettier' imported from ... eslint-plugin-prettier/worker.js`
  - `prettier` が `node_modules` に存在せず、仕様で `npm install` は禁止されているため追加していません。
- 代わりに `--no-eslintrc` で `@cybozu/eslint-config/lib/base.js` の error ルール相当（`no-undef`・`no-unused-vars`・`no-redeclare`・`no-unreachable`・`no-shadow`・`no-eval` など）を指定して `src/js/config.js` を確認しました。`kintone` は `--global kintone` として定義し、`wrap-iife` はプロジェクト設定と同じく任意形式を許可するため無効化しています。**エラー 0 件**でした。
- 正式な lint（prettier の整形ルールを含む）は、`prettier` を導入できる環境で再実行が必要です。

## 未確認事項

- 実機 kintone でのプレビュー版フォーム API の応答形状（特に `label` が文字列かオブジェクトか、SPACER の `elementId`、GROUP の入れ子）はテストのモックのみで確認しています。
- `select` の option に対する `hidden` の効き方はブラウザ依存です。仕様どおり `disabled` と併用しています。
- `replaceChildren` はモダンブラウザ前提です（kintone の対応ブラウザで利用可能と想定）。
- 実機での 15秒タイムアウト、保存後のアプリ更新フロー、Proxy 設定の読み込み失敗時の挙動は未確認です。
- `common.js` は Codex が同時変更中のため、`validateSettings` の公開インターフェースが変わっていないことだけを前提にしています。6.2 系のリクエスト形式のテストは `tests/runtime.test.cjs` 側の担当です。

## バージョン8（モデル一覧の差し替え）

### 変更したファイル
- `src/html/config.html`
- `src/js/config.js`
- `tests/config.test.cjs`
- `docs/NOTES-opencode.md`（本節を追記）

`common.js` / runtime テスト / `manifest.json` / `README.md` / SPEC は変更していません。git commit もしていません。

### 設定画面のモデル表
- 仕様 1章の7モデルに差し替えました。並び順も表のとおりです。
  `gpt-6.1-sol` / `gpt-6.2-sol` / `gpt-6.2-astra` / `gpt-6.1-terra` / `gpt-6-astra` / `gpt-6-sol` / `gpt-6-luna`
- GPT-5 系（`gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna` / `gpt-5.5`）は選択肢・許可リストから削除しました。
- 既定値（新規設定・不明／削除済みモデルのフォールバック）は `gpt-6-luna` / `medium` に変更しました。
- 「（推奨）」は GPT-6 Luna のみに付け、GPT-6.2 Astra からは外しました。
- effort の許可リストは表どおりです。`gpt-6.1-sol` / `gpt-6.2-sol` / `gpt-6.2-astra` / `gpt-6-astra` は low〜max、`gpt-6.1-terra` / `gpt-6-sol` / `gpt-6-luna` は none〜max。正規化ルール（minimal→none、none 非対応は none→low、不正値・空は medium）は v7 のまま変更していません。
- 文言は仕様 2章のとおりに差し替えました（モデルの hint、思考の深さの hint）。それ以外の UI・保存処理・フォーム取得の動作は変更していません。

### テスト（tests/config.test.cjs）
- モデル表のテストデータを新表に置き換え、新規設定が `gpt-6-luna` / `medium` であることを確認します。
- GPT-5 系の値が HTML の選択肢と画面の選択肢に存在しないことを確認します。
- 保存済みの旧 GPT-5 モデル（`gpt-5.6-terra` 等）が Luna にフォールバックし、有効な effort（xhigh）を保つことを確認します。
- Luna・6 Sol・6.1 Terra は none を保存でき、6.1 Sol は none→low になることを確認します。
- 5.6 Sol → 6.2 Astra の切り替えテストは 6 Sol → 6.2 Astra に、GPT-5.5 の max 無効化テストは 6.1 Sol の none 無効化に、意図を保って置き換えました。
- 結果：`node --test tests/config.test.cjs` は **29件すべて成功**（fail 0）。
