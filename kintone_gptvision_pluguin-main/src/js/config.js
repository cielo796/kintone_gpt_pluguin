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
  const defaultModel = 'gpt-5.2';
  const defaultReasoning = 'none';
  const baseReasoningOptions = ['none', 'low', 'medium', 'high', 'xhigh'];
  const reasoningLimitsByModel = {
    'gpt-5.2-pro': ['medium', 'high', 'xhigh'],
    'gpt-5.1': ['none', 'low', 'medium', 'high'],
    'gpt-5.1-chat-latest': ['none', 'low', 'medium', 'high']
  };

  if (!formEl || !cancelButtonEl || !apikeyEl || !modelEl || !reasoningEl || !roleEl || !contentFieldEl || !replyFieldEl || !spaceIdEl) {
    throw new Error('必須の要素が見つかりません。HTMLのクラス指定を確認してください。');
  }

  /**
   * Normalize reasoning effort for saved config and restrict to model capability.
   * - map legacy "minimal" to "none"
   * - fall back to default or first allowed value when invalid
   */
  const normalizeReasoningEffort = (model, effort) => {
    const normalized = effort === 'minimal' ? 'none' : (effort || defaultReasoning);
    const allowed = reasoningLimitsByModel[model] || baseReasoningOptions;
    if (allowed.includes(normalized)) return normalized;
    if (allowed.includes(defaultReasoning)) return defaultReasoning;
    return allowed[0];
  };

  /**
   * Disable/hide unsupported efforts for the selected model and select a valid one.
   */
  const syncReasoningOptions = (model, desiredEffort) => {
    const allowed = reasoningLimitsByModel[model] || baseReasoningOptions;
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
  const initialModel = config.model || defaultModel;
  const initialReasoning = normalizeReasoningEffort(initialModel, config.reasoningEffort);
  apikeyEl.value = config.apikey || '';
  const foundModel = modelEl.querySelector(`option[value="${initialModel}"]`);
  if (foundModel) foundModel.selected = true;
  roleEl.value = config.role || '';
  contentFieldEl.value = config.contentField || '';
  replyFieldEl.value = config.replyField || '';
  spaceIdEl.value = config.spaceId || '';
  syncReasoningOptions(initialModel, initialReasoning);

  modelEl.addEventListener('change', () => {
    syncReasoningOptions(modelEl.value || defaultModel, reasoningEl.value || defaultReasoning);
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedModel = modelEl.value || defaultModel;
    const selectedReasoning = normalizeReasoningEffort(selectedModel, reasoningEl.value || defaultReasoning);

    const newConfig = {
      apikey: apikeyEl.value.trim(),
      model: selectedModel,
      reasoningEffort: selectedReasoning,
      role: roleEl.value.trim(),
      contentField: contentFieldEl.value.trim(),
      replyField: replyFieldEl.value.trim(),
      spaceId: spaceIdEl.value.trim()
    };

    const requiredFields = [
      { value: newConfig.apikey, label: 'APIキー' },
      { value: newConfig.contentField, label: '入力フィールドコード' },
      { value: newConfig.replyField, label: '出力フィールドコード' },
      { value: newConfig.spaceId, label: 'スペースID' }
    ];

    const missing = requiredFields.find((field) => !field.value);
    if (missing) {
      alert(`${missing.label}を入力してください。`);
      return;
    }

    kintone.plugin.app.setConfig(newConfig, () => {
      alert('設定が保存されました。アプリを更新してください。');

      // Responses API 用のプロキシ設定
      const url = 'https://api.openai.com/v1/responses';
      const method = 'POST';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + newConfig.apikey
      };
      const data = {};

      kintone.plugin.app.setProxyConfig(
        url,
        method,
        headers,
        data,
        () => {
          console.log('プロキシ設定も保存されました');
          window.location.href = '../../flow?app=' + kintone.app.getId();
        },
        (error) => {
          console.error('プロキシ設定の保存中にエラーが発生しました:', error);
          alert('プロキシ設定の保存に失敗しました。もう一度お試しください。');
        }
      );
    }, (error) => {
      console.error('設定の保存中にエラーが発生しました:', error);
      alert('設定の保存に失敗しました。もう一度お試しください。');
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})(kintone.$PLUGIN_ID);
