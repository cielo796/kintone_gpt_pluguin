(function(PLUGIN_ID) {
  const config = kintone.plugin.app.getConfig(PLUGIN_ID);
  const pluginId = PLUGIN_ID;
  const url = 'https://api.openai.com/v1/chat/completions';
  const method = "POST";
  const headers = {
      'Content-Type': 'application/json',
  };

  kintone.events.on(['mobile.app.record.create.show', 'mobile.app.record.edit.show'], function(event) {
      const spaceElement = kintone.mobile.app.record.getSpaceElement(config.spaceId);

      // 親要素を作成してFlexboxに設定
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'kuc-button-container';
      spaceElement.appendChild(buttonContainer);

      const button = new Kuc.MobileButton({
          text: 'AIに問い合わせ',
          type: 'submit',
          className: 'options-class',
          id: 'options-id',
          visible: true,
          disabled: false
      });

      spaceElement.appendChild(button);

      // MobileNotificationの作成
      const notification = new Kuc.MobileNotification({
          text: 'リクエスト中です、少々お待ちください。',
          duration: -1, // 自動的には閉じない
          className: 'notification-class'
      });

      button.addEventListener('click', async () => {
          const record = kintone.mobile.app.record.get();
          const content = record.record[config.contentField].value;
          const requestData = {
              model: config.model,
              messages: [
                  {"role": "system", "content": config.role},
                  {"role": "user", "content": content}
              ],
              temperature: parseFloat(config.temperature), // 応答の創造性を制御
              max_tokens: parseInt(config.maxTokens, 10) // 生成するトークンの最大数
          };

          notification.open();

          await kintone.plugin.app.proxy(pluginId, url, method, headers, JSON.stringify(requestData), (body, status, headers) => {
              const apiResponse = JSON.parse(body);
              // ステータスコードに基づいた追加の処理
              if (status === 200) {
                  record.record[config.replyField].value = apiResponse.choices[0].message.content;
                  notification.text = 'リクエストが完了しました。';
                  setTimeout(() => {
                      notification.close();
                  }, 2000);
                  kintone.mobile.app.record.set(record);
              } else {
                  notification.text = 'APIエラーが発生しました。';
                  setTimeout(() => {
                      notification.close();
                  }, 2000);
              }
              console.log('レスポンスヘッダー:', headers);
          }, (error) => {
              notification.text = 'API通信中にエラーが発生しました。';
              setTimeout(() => {
                  notification.close();
              }, 2000);
              console.error('API通信中にエラーが発生しました:', error);
          });
      });

      return event;
  });
})(kintone.$PLUGIN_ID);