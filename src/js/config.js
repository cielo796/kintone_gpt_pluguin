(function (PLUGIN_ID) {
  const formEl = document.querySelector('.js-submit-settings');
  const cancelButtonEl = document.querySelector('.js-cancel-button');
  const apikeyEl = document.querySelector('.js-apikey');
  const modelEl = document.querySelector('.js-model');
  const roleEl = document.querySelector('.js-role');
  const contentFieldEl = document.querySelector('.js-content-field');
  const replyFieldEl = document.querySelector('.js-reply-field');
  const spaceIdEl = document.querySelector('.js-space-id');

  if (!formEl || !cancelButtonEl || !apikeyEl || !modelEl || !roleEl || !contentFieldEl || !replyFieldEl || !spaceIdEl) {
    throw new Error('必要な要素が一つまたは複数足りません。');
  }

  // プラグイン設定を取得し、既存の設定があればフィールドにセットする
  const config = kintone.plugin.app.getConfig(PLUGIN_ID);
  if (config) {
    apikeyEl.value = config.apikey || '';
    modelEl.value = config.model || '';
    roleEl.value = config.role || '';
    contentFieldEl.value = config.contentField || '';
    replyFieldEl.value = config.replyField || '';
    spaceIdEl.value = config.spaceId || ''; // スペースIDを設定
  }

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const newConfig = {
      apikey: apikeyEl.value,
      model: modelEl.value,
      role: roleEl.value,
      contentField: contentFieldEl.value,
      replyField: replyFieldEl.value,
      spaceId: spaceIdEl.value
    };

    // 設定データをプラグインストレージに保存
    kintone.plugin.app.setConfig(newConfig, () => {
      alert('設定が保存されました。アプリを更新してください！');

      // Proxy設定も保存
      const url = 'https://api.openai.com/v1/chat/completions'
      const method = "POST"
      const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + newConfig.apikey
        }
      const data = {}
    
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