# 実装仕様：バージョン7（GPT-6.2 対応＋UI刷新）

対象：このリポジトリ（kintone テキスト生成プラグイン）。**この文書に書いた変更だけを行う。**
README の「バージョン4の動作」「バージョン5のモデル設定」「バージョン6の修正」に書かれた動作は、この文書で変更すると書いたもの以外すべて維持する。

## 0. 目的
1. GPT‑6.2 Astra（`gpt-6.2-astra`）と GPT‑6.2 Sol（`gpt-6.2-sol`）に対応する（2026-11-17 公開）。
2. 画面の見た目を、別プラグイン「AI判定デモ」の UI に寄せる。寄せるのは見た目（構成・色・余白・部品の形）だけ。AI判定デモの処理内容（判定・確率・候補・信頼度など）は一切取り入れない。参照値は本書 4章・5章に書いたものだけを使う。

## 1. 共通ルール
- 素の JavaScript、IIFE、`'use strict'`。ビルドツールは追加しない。
- **kintone UI Component（KUC）と外部 CDN を廃止する。** ボタン・メッセージは DOM を直接作る。文字列は `textContent` で入れ、`innerHTML` にユーザーデータを入れない。
- `console` にキー・入力本文・回答本文を出さない（テストが console 呼び出しで失敗する）。
- APIキーは Proxy 設定（`kintone.plugin.app.setProxyConfig`）にのみ保存。レコード画面にキーを渡さない。通常設定にキーを入れない。
- 公開インターフェース `window.kintoneGptPlugins[PLUGIN_ID] = { start, validateSettings, errorMessage }` は名前と引数の意味を変えない（設定画面が `validateSettings(config, appId)` と `errorMessage(error)` を使う）。
- git commit、npm install、ネットワーク通信、ビルドはしない。

## 2. モデル表（設定画面とレコード画面で完全に一致させる）
| value | 設定画面の表示 | 使える思考の深さ（reasoning.effort） |
|---|---|---|
| `gpt-6.2-astra` | GPT-6.2 Astra（推奨） | low, medium, high, xhigh, max |
| `gpt-6.2-sol` | GPT-6.2 Sol | low, medium, high, xhigh, max |
| `gpt-6-astra` | GPT-6 Astra | low, medium, high, xhigh, max |
| `gpt-5.6-sol` | GPT-5.6 Sol | none, low, medium, high, xhigh, max |
| `gpt-5.6-terra` | GPT-5.6 Terra | none, low, medium, high, xhigh, max |
| `gpt-5.6-luna` | GPT-5.6 Luna | none, low, medium, high, xhigh, max |
| `gpt-5.5` | GPT-5.5 | none, low, medium, high, xhigh |

- 並び順は上の表のとおり。新規設定（model 未保存）の初期値は `gpt-6.2-astra` / `medium`。
- 保存済みの対応モデルはそのまま引き継ぐ（勝手に 6.2 へ変えない）。未対応・不明な model は `gpt-6.2-astra` として扱う。
- effort の正規化（両画面で同じ）：
  - `minimal` は `none` とみなす。
  - `none` を使えないモデル（6.2 Astra / 6.2 Sol / 6 Astra）では `none` → `low`。
  - それでも許可リストにない値や空は `medium`。
- 根拠：OpenAI 公式モデルページで 6.2 Astra / 6.2 Sol は effort `none` を拒否（HTTP 400）。対応値は low / medium / high / xhigh / max。

## 3. リクエスト形式（common.js）
- エンドポイント・Proxy 経由・`Content-Type` は従来どおり。
- **6.2 系（`gpt-6.2-astra`, `gpt-6.2-sol`）**：OpenAI の移行ガイドで、トップレベルの `instructions` は `input` の後ろに追加されるよう変わったため、システムプロンプトは developer メッセージとして先頭に置く。
  ```json
  { "model": "gpt-6.2-astra",
    "input": [ { "role": "developer", "content": "<システムプロンプト or 既定文>" },
               { "role": "user", "content": "<入力フィールドの本文>" } ],
    "reasoning": { "effort": "medium" } }
  ```
  `instructions` は送らない。既定文は従来と同じ `You are a helpful assistant.`。
- **それ以外のモデル**：従来どおり `{ model, instructions, input: "<本文>", reasoning }`。
- temperature / top_p などは従来どおり送らない。応答の解析（readResponse）と検証は変更しない。

## 4. レコード画面の UI（common.js / desktop.js / mobile.js / panel.css）
スペース部品の中に、次のパネルを置く（クラス接頭辞 `kgp-`）。
```
div.kgp-panel              （モバイルは div.kgp-panel.kgp-mobile）
  button.kgp-ask[type=button]   「AIに問い合わせ」／処理中は「問い合わせ中…」かつ disabled
  p.kgp-message[role=status][aria-live=polite]   空のときは hidden
  p.kgp-metrics            成功時だけ「応答時間 2.4秒」（小数1桁）。それ以外は hidden
```
- メッセージの文言は現行と同じ。種類をクラスで付ける：処理中 `kgp-message-info`、成功 `kgp-message-success`、エラー `kgp-message-error`。
- **メッセージは自動で消さない**（従来の 8 秒・4 秒の自動クローズ用タイマーは廃止）。次のクリック、画面の再表示・移動、dispose で消す。
- 応答時間は、Proxy 送信直前から応答受信までを計測（`Date.now()` で可）。
- 設定未完了など、スペースがある場合のエラーはパネル内のメッセージに表示し、ボタンは disabled にする。
- スペース自体が見つからない場合は、ヘッダースペース（PC：`kintone.app.record.getHeaderMenuSpaceElement()`、モバイル：`kintone.mobile.app.getHeaderSpaceElement()`）に同じ見た目の `div.kgp-panel` を置き、エラーメッセージだけを表示する。取得できなければ何もしない。例外は投げない。
- desktop.js / mobile.js は `start({ recordApi, getAppId, prefix, isMobile, getHeaderSpace })` のように画面ごとの差だけを渡す。
- 既存の安全策はすべて維持：二重送信防止、送信前・反映前の入力／返信の変更検知、レコードID・アプリ・URL・スペースのガード、保存（submit）や画面移動で待機中の結果を破棄、15秒／180秒タイムアウト、自動再送なし、`undefined`/`null` を空文字として扱う、書き込み後の確認。
- dispose ではパネルごと取り除く。再表示でパネルが重複しないこと。

### panel.css（AI判定デモの見た目に合わせる参照値）
```css
.kgp-panel { box-sizing:border-box; width:0; min-width:100%; max-width:100%; padding:0 8px; margin:4px 0 12px;
  color:#333; font-family:inherit; font-size:14px; line-height:1.6; overflow-wrap:anywhere; }
/* kintone 標準ボタンの見た目 */
.kgp-ask { min-width:163px; height:48px; min-height:48px; padding:0 24px; margin:0; border:1px solid #e3e7e8;
  border-radius:0; background:#f7f9fa; box-shadow:1px 1px 1px #fff inset; color:#3498db; font:inherit; font-size:16px; cursor:pointer; }
.kgp-ask:hover { background:#f7f9fa; box-shadow:0 0 2px rgba(0,0,0,.1); }
.kgp-ask:focus-visible { outline:3px solid #3498db; outline-offset:2px; }
.kgp-ask:disabled { opacity:.55; cursor:wait; }
.kgp-message, .kgp-metrics { margin:8px 0 0; }
.kgp-message-info { color:#526174; }
.kgp-message-success { color:#17613b; }
.kgp-message-error { color:#aa2222; }
.kgp-metrics { color:#526174; font-size:12px; font-variant-numeric:tabular-nums; }
.kgp-mobile .kgp-ask { width:100%; }
@media (max-width:600px) { .kgp-ask { width:100%; } }
```
旧 `desktop.css` / `mobile.css` / `51-modern-default.css` は manifest から外したので削除する。

## 5. 設定画面の UI（config.html / config.js / config.css）
### 構成（クラス接頭辞 `kgp-config-`）
```
section.kgp-config
  header.kgp-config-hero
    h2.kgp-config-heading   「AIテキスト生成プラグイン設定」
    p.kintoneplugin-desc    「入力フィールドの文章を OpenAI に送り、回答を返信フィールドに書き込みます。」
  form.js-submit-settings
    div.kgp-config-card
      h3.kgp-config-title 「基本設定」
      div.kgp-config-grid（左：label.kgp-config-label、右：div.kgp-config-control）
        APIキー［必須］   input[type=password].js-apikey（placeholder "sk-..."、autocomplete=new-password）
                           div.js-apikey-state.kgp-config-hint 「設定済み」/「未設定」
                           div.kgp-config-hint 「入力欄では伏せ字で表示します。組織のセキュリティポリシーに沿って管理してください。」
        モデル             select.js-model（2章の表の順・表示名）
                           hint 「GPT-6.2 Astra は高度な推論向け、GPT-6.2 Sol は日常業務向けで低価格です。保存済みのモデル設定は引き継ぎます。」
        入力フィールド［必須］ select.js-content-field 先頭に「選択してください」(value="")
                           hint 「AIに送る本文。テーブル外の文字列（1行・複数行）。」
        返信フィールド［必須］ select.js-reply-field 先頭に「選択してください」
                           hint 「文字列（複数行）を推奨。自動計算・ルックアップ・コピー先は選べません。」
        ボタンを置くスペース［必須］ select.js-space-id 先頭に「選択してください」
                           hint 「レイアウトのスペース（グループ内も含む）。」
      div.js-form-state.kgp-config-hint  フォーム読み込み中／失敗の案内（失敗時はエラー色）
    details.kgp-config-details
      summary.kgp-config-summary 「詳細設定（任意）」
      div.kgp-config-card.kgp-config-details-body
        div.kgp-config-section
          h4.kgp-config-section-title 「AIの動作」
          grid:
            思考の深さ        select.js-reasoning（none, low, medium（初期値）, high, xhigh, max）
                              hint 「6.2 Astra・6.2 Sol・6 Astra は low〜max、5.6 は none〜max、5.5 は none〜xhigh。高いほど時間と費用がかかります。」
            システムプロンプト  textarea.js-role rows=4（placeholder 例：あなたはカスタマーサポート担当です。…）
                              hint 「AIの役割や口調を指定します。空欄なら汎用アシスタントとして動作します。」
    div.kgp-config-actions
      button[type=button].js-cancel-button.kintoneplugin-button-dialog-cancel 「キャンセル」
      button[type=submit].js-save-button.kintoneplugin-button-dialog-ok 「保存」（初期は disabled）
```
必須マーク：`span.kgp-config-required`「必須」。

### 動作
- フィールドコードとスペースIDは**手入力からドロップダウンに変更**する。保存する設定値（`contentField`, `replyField`, `spaceId`）の形式は変えない。
- 画面表示時にプレビュー版フォームの fields と layout を取得（`kintone.api(kintone.api.url('/k/v1/preview/app/form/fields.json', true), 'GET', { app })`、layout も同様）。15秒でタイムアウト。
  - 入力の候補：トップレベルの `SINGLE_LINE_TEXT` / `MULTI_LINE_TEXT`。表示は「ラベル（コード）」。
  - 返信の候補：上と同じ型から、`expression` が空でないもの、`lookup` を持つもの、ルックアップの `fieldMappings[].field` に含まれるものを除く。
  - スペースの候補：layout の `SPACER` で `elementId` があるもの（GROUP 内も含む、重複除外）。
  - 保存済みの値が候補にないときは「コード（見つかりません）」の option を追加して選択状態にする（黙って消さない）。保存時の `validateSettings` がエラーを出す。
  - 取得後に保存ボタンを有効化。取得失敗時は `.js-form-state` に「フォーム情報を取得できませんでした。画面を再読み込みしてください。」を出し、保存ボタンは無効のまま。
- 保存処理は現行どおり：必須チェック → `validateSettings` → `setProxyConfig`（キー）成功後に `setConfig`（キーなし）→ 完了 alert → `../../flow?app=ID`。旧版の通常設定キーの移行、Proxy 読み込み失敗時に保存しない、二重保存防止、キャンセル遷移も維持。
- モデル変更時の思考の深さの連動（使えない選択肢を disabled＋hidden、正規化）を 2章の表に合わせる。

### config.css（AI判定デモの見た目に合わせる参照値）
```css
.kgp-config { max-width:960px; margin:0 auto; }
.kgp-config-hero { padding:16px 12px 8px; }
.kgp-config-heading { margin:0 0 8px; padding:8px 0; font-size:18px; }
.kgp-config-card { margin-top:12px; padding:16px 18px; border:1px solid #e3e7eb; border-radius:10px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.kgp-config-title { margin:0 0 10px; font-size:15px; }
.kgp-config-grid { display:grid; grid-template-columns:200px 1fr; gap:12px 16px; align-items:start; }
.kgp-config-label { align-self:center; font-weight:600; }
.kgp-config-control input, .kgp-config-control textarea, .kgp-config-control select {
  width:100%; box-sizing:border-box; min-height:36px; padding:6px 10px; border:1px solid #c7ccce; border-radius:4px;
  background:#fff; color:#333; font:inherit; font-size:14px; }
.kgp-config-control textarea { line-height:1.6; resize:vertical; }
.kgp-config-control input:focus, .kgp-config-control textarea:focus, .kgp-config-control select:focus { outline:2px solid #2a72ad; outline-offset:1px; }
.kgp-config-hint { margin-top:4px; color:#666; font-size:12px; }
.kgp-config-hint-error { color:#aa2222; }
.kgp-config-details { margin-top:12px; }
.kgp-config-summary { padding:14px 18px; border:1px solid #e3e7eb; border-radius:10px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.06); font-size:15px; font-weight:600; cursor:pointer; }
.kgp-config-summary:focus { outline:2px solid #2a72ad; outline-offset:1px; }
.kgp-config-details[open] .kgp-config-summary { border-bottom-right-radius:0; border-bottom-left-radius:0; }
.kgp-config-details-body { margin-top:0; border-top:0; border-top-right-radius:0; border-top-left-radius:0; }
.kgp-config-section + .kgp-config-section { margin-top:20px; padding-top:16px; border-top:1px solid #eef1f3; }
.kgp-config-section-title { margin:0 0 8px; font-size:14px; }
.kgp-config-required { margin-left:4px; color:#d23f31; font-size:11px; }
.kgp-config-actions { display:flex; justify-content:flex-end; gap:8px; padding:16px 0; }
.kgp-config-actions button { min-width:120px; min-height:44px; padding:0 20px; border:1px solid #c7ccce; border-radius:4px; background:#fff; color:#333; font:inherit; font-size:14px; cursor:pointer; }
.kgp-config-actions .js-save-button { border-color:#2a72ad; background:#2a72ad; color:#fff; font-weight:700; }
.kgp-config-actions button:disabled { opacity:.55; cursor:wait; }
@media (max-width:768px) { .kgp-config-grid { grid-template-columns:1fr; } .kgp-config-label { padding-top:4px; } }
```
`51-modern-default.css` は読み込まないので、ボタン・入力欄の見た目はすべて config.css で完結させる。

## 6. 担当分け（同時に作業する。他人の担当ファイルは編集しない）
- **Codex**：`src/js/common.js`、`src/js/desktop.js`、`src/js/mobile.js`、`src/css/panel.css`（新規）、`src/css/desktop.css`・`src/css/mobile.css`・`src/css/51-modern-default.css`（削除）、`tests/runtime.test.cjs`、`docs/NOTES-codex.md`（新規）。
- **OpenCode**：`src/html/config.html`、`src/js/config.js`、`src/css/config.css`、`tests/config.test.cjs`、`docs/NOTES-opencode.md`（新規）。
- **Claude（管理）**：`src/manifest.json`（version 7、KUC と旧 CSS を外し済み）、README、ビルド。

## 7. テスト
- `node --test` + `node:vm` のモック（通信なし）。PC・モバイルの両方。
- 追加するテスト（最低限）
  - 6.2 Astra／6.2 Sol：developer メッセージ形式で送る・`instructions` を送らない・effort none/minimal/空 → low/low/medium・max は通る。
  - 旧モデル（5.6 Terra 等）は従来形式（`instructions`＋文字列 input）のまま。
  - パネル：ボタンの文言と disabled、メッセージの種類クラス、成功時だけ応答時間、メッセージが自動で消えない、再表示で重複しない、スペースなしでヘッダーに表示。
  - 設定画面：ドロップダウンの候補（テーブル内・自動計算・ルックアップ・コピー先の除外、GROUP 内スペース）、見つからない保存値の表示、フォーム取得前・失敗時は保存不可、新規は 6.2 Astra/medium、モデル表と effort 連動、既存の移行テストは維持。
