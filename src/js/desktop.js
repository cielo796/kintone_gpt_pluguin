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

        // ダイアログの作成を先に行う
        const dialog = new Kuc.Dialog({
            title: 'kintoneGPT',
            content: 'リクエスト中です。', // ダイアログのコンテンツ
            footer: ''
        });

        // Closeボタンを作成し、ダイアログのフッターに追加
        const closeButton = new Kuc.Button({
            text: '閉じる',
            type: 'normal'
        });

        closeButton.addEventListener('click', () => {
            dialog.close();
        });

        const divEl = document.createElement('div');
        divEl.appendChild(closeButton);
        dialog.footer = divEl;
  
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
            dialog.open();

            await kintone.plugin.app.proxy(pluginId, url, method, headers, JSON.stringify(requestData), (body, status, headers) => {
                const apiResponse = JSON.parse(body);
                // ステータスコードに基づいた追加の処理
                if (status === 200) {
                    record.record[config.replyField].value = apiResponse.choices[0].message.content;
                    dialog.content.innerHTML = 'リクエストが完了しました。';
                    dialog.close();
                    kintone.app.record.set(record);
                } else {
                    dialog.content.innerHTML = 'APIエラーが発生しました。';
                }
  
                // ヘッダーから特定の情報を表示（必要に応じて）
                console.log('レスポンスヘッダー:', headers);
            }, (error) => {
                dialog.content.innerHTML = 'API通信中にエラーが発生しました。';
                console.error('API通信中にエラーが発生しました:', error);
            });
        });
  
        return event;
    });
  })(kintone.$PLUGIN_ID);