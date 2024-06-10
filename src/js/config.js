(function (PLUGIN_ID) {
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const apikeyEl = document.querySelector('.js-apikey');
  const modelEl = document.querySelector('.js-model');
  const temperatureEl = document.querySelector('.js-temperature');
  const temperatureValueEl = document.getElementById('temperatureValue');
  const maxTokensEl = document.querySelector('.js-maxTokens');
  const maxTokensValueEl = document.getElementById('maxTokensValue');
  const roleEl = document.querySelector('.js-role');
  const contentFieldEl = document.querySelector('.js-content-field');
  const replyFieldEl = document.querySelector('.js-reply-field');
  const spaceIdEl = document.querySelector('.js-space-id');


  if (!formEl || !cancelButtonEl || !apikeyEl || !modelEl || !temperatureEl || !temperatureValueEl || !maxTokensEl || !maxTokensValueEl || !roleEl || !contentFieldEl || !replyFieldEl || !spaceIdEl) {
    throw new Error('必要な要素が一つまたは複数足りません。');
  }

  const config = kintone.plugin.app.getConfig(PLUGIN_ID);
  if (config) {
    apikeyEl.value = config.apikey || '';
    if (config.model) {
      let modelOption = modelEl.querySelector(`option[value="${config.model}"]`);
      if (modelOption) {
        modelOption.selected = true;
      }
    }
    temperatureEl.value = config.temperature || '0.7';
    temperatureValueEl.textContent = config.temperature || '0.7';
    maxTokensEl.value = config.maxTokens || '4096';
    maxTokensValueEl.textContent = config.maxTokens || '4096';
    roleEl.value = config.role || '';
    contentFieldEl.value = config.contentField || '';
    replyFieldEl.value = config.replyField || '';
    spaceIdEl.value = config.spaceId || '';
  }

  temperatureEl.addEventListener('input', (e) => {
    temperatureValueEl.textContent = e.target.value;
  });

  maxTokensEl.addEventListener('input', (e) => {
    maxTokensValueEl.textContent = e.target.value;
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const newConfig = {
      apikey: apikeyEl.value,
      model: modelEl.value,
      temperature: temperatureEl.value,
      maxTokens: maxTokensEl.value,
      role: roleEl.value,
      contentField: contentFieldEl.value,
      replyField: replyFieldEl.value,
      spaceId: spaceIdEl.value
    };

    kintone.plugin.app.setConfig(newConfig, () => {
      alert('設定が保存されました。アプリを更新してください！');

      const url = 'https://api.openai.com/v1/chat/completions';
      const method = "POST";
      const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + newConfig.apikey
      };
      const data = {};

      kintone.plugin.app.setProxyConfig(url, method, headers, data, () => {
        console.log('プロキシ設定も保存されました');
        window.location.href = '../../flow?app=' + kintone.app.getId();
      }, (error) => {
        console.error('プロキシ設定の保存中にエラーが発生しました:', error);
        alert('プロキシ設定の保存に失敗しました。もう一度お試しください。');
      });

    }, (error) => {
      console.error('設定の保存中にエラーが発生しました:', error);
      alert('設定の保存に失敗しました。もう一度お試しください。');
    });
  });

  cancelButtonEl.addEventListener('click', () => {
    window.location.href = '../../' + kintone.app.getId() + '/plugin/';
  });
})(kintone.$PLUGIN_ID);