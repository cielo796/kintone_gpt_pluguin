(function(PLUGIN_ID) {
  'use strict';

  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const apikeyEl = document.querySelector('.js-apikey');
  const apikeyStateEl = document.querySelector('.js-apikey-state');
  const modelEl = document.querySelector('.js-model');
  const reasoningEl = document.querySelector('.js-reasoning');
  const roleEl = document.querySelector('.js-role');
  const contentFieldEl = document.querySelector('.js-content-field');
  const replyFieldEl = document.querySelector('.js-reply-field');
  const spaceIdEl = document.querySelector('.js-space-id');
  const formStateEl = document.querySelector('.js-form-state');
  const saveButtonEl = document.querySelector('.js-save-button');

  const proxyUrl = 'https://api.openai.com/v1/responses';
  const proxyMethod = 'POST';
  const textTypes = ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT'];
  const defaultModel = 'gpt-6-luna';
  const defaultReasoning = 'medium';
  const models = [
    { value: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6.2-sol', label: 'GPT-6.2 Sol', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6.2-astra', label: 'GPT-6.2 Astra', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6-astra', label: 'GPT-6 Astra', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6-sol', label: 'GPT-6 Sol', efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna（推奨）', efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }
  ];
  const modelValues = models.map((model) => model.value);
  const effortsByModel = {};
  models.forEach((model) => { effortsByModel[model.value] = model.efforts; });

  let saving = false;
  let proxyConfigLoaded = false;
  let formLoaded = false;

  if (!formEl || !cancelButtonEl || !apikeyEl || !apikeyStateEl || !modelEl || !reasoningEl ||
      !roleEl || !contentFieldEl || !replyFieldEl || !spaceIdEl || !formStateEl || !saveButtonEl) {
    throw new Error('必須の要素が見つかりません。HTMLのクラス指定を確認してください。');
  }

  const resolveModel = (model) => modelValues.includes(model) ? model : defaultModel;

  /**
   * Normalize reasoning effort the same way on the settings screen and record screens.
   * - map legacy "minimal" to "none"
   * - models that reject "none" use "low" instead
   * - empty or unsupported values fall back to "medium"
   */
  const normalizeReasoningEffort = (model, effort) => {
    const allowed = effortsByModel[model] || effortsByModel[defaultModel];
    let normalized = effort === 'minimal' ? 'none' : (effort || '');
    if (!allowed.includes('none') && normalized === 'none') normalized = 'low';
    return allowed.includes(normalized) ? normalized : defaultReasoning;
  };

  const findOption = (selectEl, value) =>
    Array.from(selectEl.options || []).find((option) => option.value === value);

  /**
   * Disable and hide unsupported efforts for the selected model, then select a valid one.
   */
  const syncReasoningOptions = (model, desiredEffort) => {
    const allowed = effortsByModel[model] || effortsByModel[defaultModel];
    Array.from(reasoningEl.options || []).forEach((option) => {
      const isAllowed = allowed.includes(option.value);
      option.disabled = !isAllowed;
      option.hidden = !isAllowed;
    });
    const resolved = normalizeReasoningEffort(model, desiredEffort);
    const target = findOption(reasoningEl, resolved) || reasoningEl.options[0];
    if (target) {
      target.selected = true;
      reasoningEl.value = target.value;
    }
  };

  const updateApiKeyState = () => {
    apikeyStateEl.textContent = apikeyEl.value.trim() ? '設定済み' : '未設定';
  };

  // 既存設定を反映する。
  const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
  const initialModel = resolveModel(config.model);
  try {
    // 専用設定を優先し、旧版の通常設定にしかないキーも移行できるようにする。
    const proxyConfig = kintone.plugin.app.getProxyConfig(proxyUrl, proxyMethod);
    const authorization = proxyConfig?.headers?.Authorization || '';
    const proxyKey = authorization.replace(/^Bearer\s+/i, '').trim();
    apikeyEl.value = proxyKey || config.apikey || '';
    proxyConfigLoaded = true;
  } catch (error) {
    // 読み込み失敗時に既存の認証設定を上書きしない。エラーにキーが含まれる可能性もある。
    alert('APIキー設定を読み込めませんでした。画面を再読み込みしてください。');
  }
  updateApiKeyState();
  apikeyEl.addEventListener('input', updateApiKeyState);

  const initialModelOption = findOption(modelEl, initialModel);
  if (initialModelOption) initialModelOption.selected = true;
  modelEl.value = initialModel;
  roleEl.value = config.role || '';
  // 保存済みのシステムプロンプトがあれば、詳細設定を開いて見落としを防ぐ。
  const detailsEl = document.querySelector('.kgp-config-details');
  if (detailsEl && config.role) detailsEl.open = true;
  syncReasoningOptions(initialModel, config.reasoningEffort);

  modelEl.addEventListener('change', () => {
    const model = resolveModel(modelEl.value);
    syncReasoningOptions(model, reasoningEl.value);
  });

  const withTimeout = async (task, milliseconds, message) => {
    let timer;
    try {
      return await Promise.race([task, new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  };

  const setFormState = (text, isError) => {
    formStateEl.textContent = text;
    formStateEl.classList.toggle('kgp-config-hint-error', Boolean(isError));
  };

  const createOption = (value, text) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  };

  const setSelectOptions = (selectEl, items, savedValue) => {
    const options = items.map((item) => createOption(item.value, item.label));
    const value = savedValue || '';
    // 保存済みの値を黙って消さず、見つからないことが分かる選択肢として残す。
    if (value && !items.some((item) => item.value === value)) {
      options.push(createOption(value, value + '（見つかりません）'));
    }
    selectEl.replaceChildren(...options);
    selectEl.value = value;
  };

  const fieldLabel = (code, field) => {
    const label = typeof field?.label === 'string' && field.label ? field.label : code;
    return label + '（' + code + '）';
  };

  const textFieldCodes = (properties) =>
    Object.keys(properties).filter((code) => textTypes.includes(properties[code]?.type));

  const collectLookupCopyTargets = (properties) => {
    const targets = new Set();
    const visit = (fields) => {
      Object.keys(fields || {}).forEach((code) => {
        const field = fields[code];
        if (Array.isArray(field?.lookup?.fieldMappings)) {
          field.lookup.fieldMappings.forEach((mapping) => {
            if (mapping?.field) targets.add(mapping.field);
          });
        }
        if (field?.fields) visit(field.fields);
      });
    };
    visit(properties);
    return targets;
  };

  const replyFieldCodes = (properties) => {
    const copied = collectLookupCopyTargets(properties);
    return textFieldCodes(properties).filter((code) => {
      const field = properties[code] || {};
      return !field.expression &&
        !Object.prototype.hasOwnProperty.call(field, 'lookup') && !copied.has(code);
    });
  };

  const collectSpaceIds = (layout) => {
    const ids = [];
    const visit = (rows) => {
      if (!Array.isArray(rows)) return;
      rows.forEach((row) => {
        if (row?.type === 'GROUP') {
          visit(row.layout);
        } else if (row?.type === 'ROW' && Array.isArray(row.fields)) {
          row.fields.forEach((field) => {
            if (field?.type === 'SPACER' && field.elementId && !ids.includes(field.elementId)) {
              ids.push(field.elementId);
            }
          });
        }
      });
    };
    visit(layout);
    return ids;
  };

  const populateSelects = (properties, layout) => {
    const placeholder = { value: '', label: '選択してください' };
    const toOptions = (codes) => [placeholder].concat(codes.map((code) =>
      ({ value: code, label: fieldLabel(code, properties[code]) })));

    setSelectOptions(contentFieldEl, toOptions(textFieldCodes(properties)), config.contentField);
    setSelectOptions(replyFieldEl, toOptions(replyFieldCodes(properties)), config.replyField);
    setSelectOptions(spaceIdEl, [placeholder].concat(collectSpaceIds(layout).map((id) =>
      ({ value: id, label: id }))), config.spaceId);
  };

  const loadFormInfo = async () => {
    const appId = kintone.app.getId();
    const get = (name) =>
      kintone.api(kintone.api.url('/k/v1/preview/app/form/' + name + '.json', true), 'GET', { app: appId });
    try {
      const [fields, layout] = await withTimeout(
        Promise.all([get('fields'), get('layout')]),
        15000, 'フォーム情報の取得がタイムアウトしました。');
      if (!fields || typeof fields.properties !== 'object' || !layout || !Array.isArray(layout.layout)) {
        throw new Error('invalid form');
      }
      populateSelects(fields.properties, layout.layout);
      formLoaded = true;
      saveButtonEl.disabled = false;
      setFormState('', false);
    } catch (error) {
      formLoaded = false;
      saveButtonEl.disabled = true;
      setFormState('フォーム情報を取得できませんでした。画面を再読み込みしてください。', true);
    }
  };

  saveButtonEl.disabled = true;
  loadFormInfo();

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!proxyConfigLoaded) {
      alert('APIキー設定を読み込めていません。画面を再読み込みしてください。');
      return;
    }
    if (!formLoaded) {
      alert('フォーム情報を取得できていません。画面を再読み込みしてください。');
      return;
    }

    const apikey = apikeyEl.value.trim();
    const selectedModel = resolveModel(modelEl.value);
    const selectedReasoning = normalizeReasoningEffort(selectedModel, reasoningEl.value);

    const newConfig = {
      apiKeyConfigured: 'true',
      model: selectedModel,
      reasoningEffort: selectedReasoning,
      role: roleEl.value.trim(),
      contentField: contentFieldEl.value.trim(),
      replyField: replyFieldEl.value.trim(),
      spaceId: spaceIdEl.value.trim()
    };

    const required = [
      { value: apikey, message: 'APIキーを入力してください。' },
      { value: newConfig.contentField, message: '入力フィールドを選択してください。' },
      { value: newConfig.replyField, message: '返信フィールドを選択してください。' },
      { value: newConfig.spaceId, message: 'ボタンを置くスペースを選択してください。' }
    ];
    const missing = required.find((field) => !field.value);
    if (missing) {
      alert(missing.message);
      return;
    }

    saving = true;
    saveButtonEl.disabled = true;
    const onSaveError = () => {
      saving = false;
      saveButtonEl.disabled = false;
      alert('設定の保存に失敗しました。もう一度お試しください。');
    };
    try {
      await window.kintoneGptPlugins[PLUGIN_ID].validateSettings(newConfig, kintone.app.getId());
    } catch (error) {
      saving = false;
      saveButtonEl.disabled = false;
      alert(window.kintoneGptPlugins[PLUGIN_ID].errorMessage(error));
      return;
    }
    try {
      // キーを専用設定へ保存してから、通常設定をキーを含まない内容で置き換える。
      // 両APIの公開仕様は成功コールバックのみ（失敗コールバックはない）。
      kintone.plugin.app.setProxyConfig(
        proxyUrl,
        proxyMethod,
        {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apikey
        },
        {},
        () => {
          try {
            kintone.plugin.app.setConfig(newConfig, () => {
              alert('設定が保存されました。アプリを更新してください。');
              window.location.href = '../../flow?app=' + kintone.app.getId();
            });
          } catch (error) {
            onSaveError();
          }
        }
      );
    } catch (error) {
      onSaveError();
    }
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})(kintone.$PLUGIN_ID);
