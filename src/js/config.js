(function(PLUGIN_ID) {
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const apikeyEl = document.querySelector('.js-apikey');
  const modelEl = document.querySelector('.js-model');
  const reasoningEl = document.querySelector('.js-reasoning');
  const roleEl = document.querySelector('.js-role');
  const contentFieldEl = document.querySelector('.js-content-field');
  const replyFieldEl = document.querySelector('.js-reply-field');
  const spaceIdEl = document.querySelector('.js-space-id');
  const saveButtonEl = document.querySelector('.kintoneplugin-button-dialog-ok');
  const proxyUrl = 'https://api.openai.com/v1/responses';
  const proxyMethod = 'POST';
  let saving = false;
  let proxyConfigLoaded = false;
  const defaultModel = 'gpt-6-astra';
  const supportedModels = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5'];
  const defaultReasoning = 'medium';
  const defaultReasoningByModel = {
    'gpt-6-astra': 'medium',
    'gpt-5.6-sol': 'medium',
    'gpt-5.6-terra': 'medium',
    'gpt-5.6-luna': 'medium',
    'gpt-5.5': 'medium'
  };
  const gpt55ReasoningOptions = ['none', 'low', 'medium', 'high', 'xhigh'];
  const gpt56ReasoningOptions = [...gpt55ReasoningOptions, 'max'];
  const reasoningLimitsByModel = {
    'gpt-6-astra': ['low', 'medium', 'high', 'xhigh', 'max'],
    'gpt-5.6-sol': gpt56ReasoningOptions,
    'gpt-5.6-terra': gpt56ReasoningOptions,
    'gpt-5.6-luna': gpt56ReasoningOptions,
    'gpt-5.5': gpt55ReasoningOptions
  };

  if (!formEl || !cancelButtonEl || !apikeyEl || !modelEl || !reasoningEl || !roleEl || !contentFieldEl || !replyFieldEl || !spaceIdEl) {
    throw new Error('必須の要素が見つかりません。HTMLのクラス指定を確認してください。');
  }

  /**
   * Normalize reasoning effort for saved config and restrict to model capability.
   * - map legacy "minimal" to "none"
   * - fall back to default or first allowed value when invalid
   */
  const getDefaultReasoning = (model) => defaultReasoningByModel[model] || defaultReasoning;
  const resolveModel = (model) => supportedModels.includes(model) ? model : defaultModel;
  const normalizeReasoningEffort = (model, effort) => {
    const defaultEffort = getDefaultReasoning(model);
    if (model === 'gpt-6-astra' && (effort === 'none' || effort === 'minimal')) return 'low';
    const normalized = effort === 'minimal' ? 'none' : (effort || defaultEffort);
    const allowed = reasoningLimitsByModel[model] || gpt55ReasoningOptions;
    if (allowed.includes(normalized)) return normalized;
    if (allowed.includes(defaultEffort)) return defaultEffort;
    return allowed[0];
  };

  /**
   * Disable/hide unsupported efforts for the selected model and select a valid one.
   */
  const syncReasoningOptions = (model, desiredEffort) => {
    const allowed = reasoningLimitsByModel[model] || gpt55ReasoningOptions;
    Array.from(reasoningEl.options).forEach((option) => {
      const isAllowed = allowed.includes(option.value);
      option.disabled = !isAllowed;
      option.hidden = !isAllowed;
    });
    const resolved = normalizeReasoningEffort(model, desiredEffort);
    const target = reasoningEl.querySelector(`option[value="${resolved}"]`);
    if (target) {
      target.selected = true;
    } else if (reasoningEl.options.length) {
      reasoningEl.selectedIndex = 0;
    }
  };

  // 既存設定を反映
  const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
  const initialModel = resolveModel(config.model);
  const initialReasoning = normalizeReasoningEffort(initialModel, config.reasoningEffort);
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
  const foundModel = modelEl.querySelector(`option[value="${initialModel}"]`);
  if (foundModel) foundModel.selected = true;
  roleEl.value = config.role || '';
  contentFieldEl.value = config.contentField || '';
  replyFieldEl.value = config.replyField || '';
  spaceIdEl.value = config.spaceId || '';
  syncReasoningOptions(initialModel, initialReasoning);

  modelEl.addEventListener('change', () => {
    const model = modelEl.value || defaultModel;
    syncReasoningOptions(model, reasoningEl.value || getDefaultReasoning(model));
  });

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!proxyConfigLoaded) {
      alert('APIキー設定を読み込めていません。画面を再読み込みしてください。');
      return;
    }

    const apikey = apikeyEl.value.trim();
    const selectedModel = resolveModel(modelEl.value);
    const selectedReasoning = normalizeReasoningEffort(selectedModel, reasoningEl.value || getDefaultReasoning(selectedModel));

    const newConfig = {
      apiKeyConfigured: 'true',
      model: selectedModel,
      reasoningEffort: selectedReasoning,
      role: roleEl.value.trim(),
      contentField: contentFieldEl.value.trim(),
      replyField: replyFieldEl.value.trim(),
      spaceId: spaceIdEl.value.trim()
    };

    const requiredFields = [
      { value: apikey, label: 'APIキー' },
      { value: newConfig.contentField, label: '入力フィールドコード' },
      { value: newConfig.replyField, label: '出力フィールドコード' },
      { value: newConfig.spaceId, label: 'スペースID' }
    ];

    const missing = requiredFields.find((field) => !field.value);
    if (missing) {
      alert(`${missing.label}を入力してください。`);
      return;
    }

    saving = true;
    if (saveButtonEl) saveButtonEl.disabled = true;
    const onSaveError = () => {
      saving = false;
      if (saveButtonEl) saveButtonEl.disabled = false;
      alert('設定の保存に失敗しました。もう一度お試しください。');
    };
    try {
      await window.kintoneGptPlugins[PLUGIN_ID].validateSettings(newConfig, kintone.app.getId());
    } catch (error) {
      saving = false;
      if (saveButtonEl) saveButtonEl.disabled = false;
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
