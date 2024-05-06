(function(PLUGIN_ID) {
  const config = kintone.plugin.app.getConfig(PLUGIN_ID);
  const pluginId = PLUGIN_ID;
  const url = 'https://api.openai.com/v1/chat/completions'
  const method = "POST"
  const headers = {
    'Content-Type': 'application/json',
}

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {
      const spaceElement = kintone.app.record.getSpaceElement(config.spaceId);

      const button = new Kuc.Button({
          text: 'AIに問い合わせる',
          type: 'submit',
          className: 'options-class',
          id: 'options-id',
          visible: true,
          disabled: false
      });

      spaceElement.appendChild(button);

      button.addEventListener('click', async () => {
          const record = kintone.app.record.get();
          const content = record.record[config.contentField].value;
          const requestData = {
              model: config.model,
              messages: [
                  {"role": "system", "content": config.role},
                  {"role": "user", "content": content}
              ]
          };
          await kintone.plugin.app.proxy(pluginId, url, method, headers, JSON.stringify(requestData), (body, status, headers) => {
              const apiResponse = JSON.parse(body);
              alert(`Response: ${JSON.stringify(apiResponse, null, 2)}`); // 整形されたレスポンスを表示

              // ステータスコードに基づいた追加の処理
              if (status === 200) {
                  record.record[config.replyField].value = apiResponse.choices[0].message.content;
                  kintone.app.record.set(record);
              } else {
                  alert(`APIエラー: ステータスコード ${status}`);
              }

              // ヘッダーから特定の情報を表示（必要に応じて）
              console.log('レスポンスヘッダー:', headers);
          }, (error) => {
              console.error('API通信中にエラーが発生しました:', error);
          });
      });

      return event;
  });
})(kintone.$PLUGIN_ID);