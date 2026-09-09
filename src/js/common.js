(function(PLUGIN_ID) {
  'use strict';
  const endpoint = 'https://api.openai.com/v1/responses';
  const textTypes = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  class UserError extends Error {}
  class CancelledError extends Error {}
  const fail = (message) => { throw new UserError(message); };
  const errorMessage = (error) => error instanceof UserError ? error.message :
    '処理に失敗しました。設定と通信状況を確認して、もう一度お試しください。';

  async function withTimeout(task, milliseconds, message) {
    let timer;
    try {
      return await Promise.race([task, new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new UserError(message)), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  }

  function validateFields(config, properties) {
    if (!properties || typeof properties !== 'object') fail('フォーム情報を取得できませんでした。再読み込みしてください。');
    for (const [key, label] of [['contentField', '入力'], ['replyField', '出力']]) {
      const code = config[key];
      if (!code || !Object.prototype.hasOwnProperty.call(properties, code)) {
        fail(`${label}フィールド「${code || '未設定'}」が見つかりません。テーブル外のフィールドを指定してください。`);
      }
      if (!textTypes.includes(properties[code].type)) fail(`${label}フィールド「${code}」は文字列（1行・複数行）を指定してください。`);
    }
    const output = properties[config.replyField];
    if (output.expression || Object.prototype.hasOwnProperty.call(output, 'lookup')) {
      fail('出力先には自動計算・ルックアップ以外の文字列フィールドを指定してください。');
    }
    const copied = Object.values(properties).some((field) =>
      Array.isArray(field.lookup?.fieldMappings) && field.lookup.fieldMappings.some((mapping) => mapping.field === config.replyField));
    if (copied) fail('ルックアップのコピー先は出力フィールドに指定できません。');
    return output;
  }

  function hasSpace(layout, spaceId) {
    return Array.isArray(layout) && layout.some((row) =>
      (row.type === 'GROUP' && hasSpace(row.layout, spaceId)) ||
      (row.type === 'ROW' && Array.isArray(row.fields) && row.fields.some((field) =>
        field.type === 'SPACER' && field.elementId === spaceId)));
  }

  async function loadForm(appId, preview, includeLayout) {
    const prefix = preview ? '/k/v1/preview/app/form/' : '/k/v1/app/form/';
    const get = (name) => kintone.api(kintone.api.url(prefix + name + '.json', true), 'GET', { app: appId });
    try {
      const [fields, layout] = await withTimeout(
        Promise.all([get('fields'), includeLayout ? get('layout') : Promise.resolve(null)]),
        15000, 'フォーム情報の取得がタイムアウトしました。もう一度お試しください。');
      return { properties: fields?.properties, layout: layout?.layout };
    } catch (error) {
      if (error instanceof UserError) throw error;
      fail('フォーム情報を取得できませんでした。アプリの権限と通信状況を確認してください。');
    }
  }

  async function validateSettings(config, appId) {
    const form = await loadForm(appId, true, true);
    validateFields(config, form.properties);
    if (!config.spaceId || !hasSpace(form.layout, config.spaceId)) {
      fail(`スペース「${config.spaceId || '未設定'}」が見つかりません。要素IDを確認してください。`);
    }
  }

  // Empty text values in create/edit screens may be undefined (or null after customization).
  const textValue = (field) => field.value ?? '';

  function validateRecord(config, record) {
    if (!record) fail('編集画面のレコードを取得できませんでした。画面を開き直してください。');
    for (const [key, label] of [['contentField', '入力'], ['replyField', '出力']]) {
      const field = record[config[key]];
      if (!field) fail(`${label}フィールド「${config[key]}」を利用できません。管理者に設定・権限の確認を依頼してください。`);
      if (!textTypes.includes(field.type) || typeof textValue(field) !== 'string') fail(`${label}フィールドは文字列（1行・複数行）である必要があります。`);
    }
    if (record[config.replyField].disabled) fail('出力フィールドが編集不可です。管理者に確認してください。');
  }

  function readResponse(body, httpStatus) {
    if (httpStatus === 401) fail('API認証に失敗しました。管理者にAPIキーの確認を依頼してください。');
    if (httpStatus === 403) fail('AIモデルを利用する権限がありません。管理者に確認してください。');
    if (httpStatus === 429) fail('APIの利用制限に達しました。時間をおくか、管理者に利用上限を確認してください。');
    if (httpStatus >= 500) fail('AIサービスでエラーが発生しました。時間をおいて再度お試しください。');
    if (httpStatus !== 200) fail('APIリクエストが拒否されました。モデルや設定内容を確認してください。');
    let response;
    try { response = JSON.parse(body); } catch (error) { fail('AIサービスから正しいJSON形式の応答を受信できませんでした。'); }
    if (!response || typeof response !== 'object' || Array.isArray(response)) fail('AIサービスの応答形式が不正です。');
    if (response.status === 'incomplete') fail('回答が途中で終了しました。返信は変更していません。入力や思考設定を見直してください。');
    if (response.status !== 'completed' || response.error) fail('回答の生成が正常に完了しませんでした。返信は変更していません。');
    if (response.output !== undefined && !Array.isArray(response.output)) fail('AIサービスの応答形式が不正です。');
    const messages = Array.isArray(response.output) ? response.output.filter((item) => item?.type === 'message' && item.role === 'assistant') : [];
    if (messages.some((message) => !Array.isArray(message.content))) fail('AIサービスの回答本文の形式が不正です。');
    const parts = messages.flatMap((message) => Array.isArray(message.content) ? message.content : []);
    if (parts.some((part) => part?.type === 'refusal')) fail('AIがこの依頼への回答を拒否しました。入力内容を見直してください。');
    if (messages.some((message) => message.status && message.status !== 'completed')) fail('回答が途中で終了しました。返信は変更していません。');
    const textParts = parts.filter((part) => part?.type === 'output_text');
    if (textParts.some((part) => typeof part.text !== 'string')) fail('AIサービスの回答本文の形式が不正です。');
    const text = textParts.length ? textParts.map((part) => part.text).join('\n').trim() :
      (typeof response.output_text === 'string' ? response.output_text.trim() : '');
    if (!text) fail('AIから回答本文が返されませんでした。返信は変更していません。');
    return text;
  }

  function validateAnswer(text, output) {
    if (output.type === 'SINGLE_LINE_TEXT' && /[\r\n]/.test(text)) fail('回答が複数行のため反映できません。出力先を文字列（複数行）に変更してください。');
    const length = Array.from(text).length;
    if ((output.maxLength && length > Number(output.maxLength)) || (output.minLength && length < Number(output.minLength))) {
      fail('回答の文字数が出力フィールドの制限に合いません。返信は変更していません。');
    }
  }

  function requestData(config, content) {
    const models = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5'];
    const model = models.includes(config.model) ? config.model : models[0];
    const efforts = model === 'gpt-6-astra' ? ['low', 'medium', 'high', 'xhigh'] : ['none', 'low', 'medium', 'high', 'xhigh'];
    if (model !== 'gpt-5.5') efforts.push('max');
    let desired = config.reasoningEffort === 'minimal' ? 'none' : config.reasoningEffort;
    if (model === 'gpt-6-astra' && desired === 'none') desired = 'low';
    return { model, instructions: config.role || 'You are a helpful assistant.', input: content,
      reasoning: { effort: efforts.includes(desired) ? desired : 'medium' } };
  }

  function start({ recordApi, getAppId, prefix, Button, Notification }) {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
    let current;
    function dispose() {
      if (!current) return;
      current.active = false;
      current.cancel?.();
      clearTimeout(current.noticeTimer);
      current.notification.close();
      current.button?.remove();
      current = null;
    }
    function notify(session, text, duration = 8000) {
      clearTimeout(session.noticeTimer);
      session.notification.text = text;
      session.notification.open();
      if (duration) session.noticeTimer = setTimeout(() => session.notification.close(), duration);
    }
    kintone.events.on([prefix + '.record.index.show', prefix + '.record.detail.show'], (event) => { dispose(); return event; });
    // Stop pending updates on save attempts, including saves rejected by other validation.
    kintone.events.on([prefix + '.record.create.submit', prefix + '.record.edit.submit'], (event) => { current?.cancel?.(); return event; });
    // Keep the button available if the browser restores this page from its back/forward cache.
    window.addEventListener('pagehide', () => {
      current?.cancel?.();
      if (current) { clearTimeout(current.noticeTimer); current.notification.close(); }
    });
    window.addEventListener('popstate', dispose);
    window.addEventListener('hashchange', dispose);
    kintone.events.on([prefix + '.record.create.show', prefix + '.record.edit.show'], (event) => {
      dispose();
      const session = { active: true, busy: false, notification: new Notification({ text: '', duration: -1 }) };
      current = session;
      try {
        if (!config.spaceId || !config.contentField || !config.replyField) fail('プラグインの設定が未完了です。管理者に設定確認を依頼してください。');
        const space = recordApi.getSpaceElement(config.spaceId);
        if (!space) fail(`スペース「${config.spaceId}」が見つかりません。管理者に設定確認を依頼してください。`);
        const button = new Button({ text: 'AIに問い合わせ', type: 'normal', disabled: false });
        session.button = button;
        space.appendChild(button);
        button.addEventListener('click', async () => {
          if (!session.active || session.busy) return;
          session.busy = true;
          button.disabled = true;
          button.text = '問い合わせ中…';
          const request = { valid: true };
          const page = window.location.href;
          const appId = getAppId();
          let timer;
          const checkCurrent = () => {
            if (!request.valid || !session.active || current !== session || window.location.href !== page ||
                getAppId() !== appId || !button.isConnected || recordApi.getSpaceElement(config.spaceId) !== space) throw new CancelledError();
          };
          const cancellation = new Promise((resolve, reject) => {
            session.cancel = () => { request.valid = false; reject(new CancelledError()); };
            // UI timeout does not stop execution on OpenAI's server. Never auto-retry.
            timer = setTimeout(() => {
              request.valid = false;
              reject(new UserError('問い合わせがタイムアウトしました。遅れて届く回答は反映しません。時間をおいて再度お試しください。'));
            }, 180000);
          });
          const perform = async () => {
            const initial = recordApi.get();
            validateRecord(config, initial?.record);
            const content = textValue(initial.record[config.contentField]);
            const oldReply = textValue(initial.record[config.replyField]);
            const recordId = initial.record.$id?.value;
            if (!content.trim()) fail('入力フィールドが空です。内容を入力してください。');
            notify(session, 'リクエスト中です。しばらくお待ちください。', 0);
            const form = await loadForm(appId, false, false);
            checkCurrent();
            const output = validateFields(config, form.properties);
            const beforeSend = recordApi.get();
            validateRecord(config, beforeSend?.record);
            if (textValue(beforeSend.record[config.contentField]) !== content || textValue(beforeSend.record[config.replyField]) !== oldReply || beforeSend.record.$id?.value !== recordId) {
              fail('入力または返信が変更されたため送信を中止しました。必要に応じて再度問い合わせてください。');
            }
            let result;
            try {
              result = await kintone.plugin.app.proxy(PLUGIN_ID, endpoint, 'POST',
                { 'Content-Type': 'application/json' }, JSON.stringify(requestData(config, content)));
            } catch (error) { fail('API通信に失敗しました。通信状況を確認して、もう一度お試しください。'); }
            checkCurrent();
            if (!Array.isArray(result)) fail('AIサービスの応答形式が不正です。');
            const text = readResponse(result[0], result[1]);
            validateAnswer(text, output);
            const latest = recordApi.get();
            validateRecord(config, latest?.record);
            if (latest.record.$id?.value !== recordId) throw new CancelledError();
            if (textValue(latest.record[config.contentField]) !== content || textValue(latest.record[config.replyField]) !== oldReply) {
              fail('待機中に入力または返信が変更されたため、回答の自動反映を中止しました。必要に応じて再度問い合わせてください。');
            }
            latest.record[config.replyField].value = text;
            recordApi.set(latest);
            if (recordApi.get()?.record?.[config.replyField]?.value !== text) fail('返信を反映できませんでした。出力フィールドの編集権限や制限を確認してください。');
          };
          try {
            await Promise.race([perform(), cancellation]);
            checkCurrent();
            notify(session, '回答を入力しました。レコードを保存してください。', 4000);
          } catch (error) {
            if (!(error instanceof CancelledError) && session.active && current === session) notify(session, errorMessage(error));
            else { clearTimeout(session.noticeTimer); session.notification.close(); }
          } finally {
            request.valid = false;
            clearTimeout(timer);
            session.cancel = null;
            session.busy = false;
            button.disabled = false;
            button.text = 'AIに問い合わせ';
          }
        });
      } catch (error) { notify(session, errorMessage(error)); }
      return event;
    });
  }
  window.kintoneGptPlugins = window.kintoneGptPlugins || {};
  window.kintoneGptPlugins[PLUGIN_ID] = { start, validateSettings, errorMessage };
})(kintone.$PLUGIN_ID);
