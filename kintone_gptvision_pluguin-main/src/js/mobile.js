(function(PLUGIN_ID) {
  const config = kintone.plugin.app.getConfig(PLUGIN_ID);
  const pluginId = PLUGIN_ID;
  const url = 'https://api.openai.com/v1/responses';
  const method = 'POST';
  const headers = {
    'Content-Type': 'application/json'
  };
  // default to latest public model (from OpenAI documented spec)
  const safeModel = config.model || 'gpt-5.2';
  const safeReasoning = config.reasoningEffort || 'medium';
  const safeSystem = config.role || 'You are a helpful assistant.';

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
      text: 'リクエスト中です。少々お待ちください。',
      duration: -1, // 自動的には閉じない
      className: 'notification-class'
    });

    button.addEventListener('click', async () => {
      const record = kintone.mobile.app.record.get();
      const content = record.record[config.contentField]?.value || '';

      if (!content.trim()) {
        notification.text = '入力フィールドが空です。内容を入力してください。';
        notification.open();
        setTimeout(() => notification.close(), 2000);
        return;
      }

      const requestData = {
        model: safeModel,
        input: [
          { role: 'system', content: safeSystem },
          { role: 'user', content: content }
        ],
        reasoning_effort: safeReasoning,
        stream: false
      };

      notification.open();

      await kintone.plugin.app.proxy(
        pluginId,
        url,
        method,
        headers,
        JSON.stringify(requestData),
        (body, status, responseHeaders) => {
          const apiResponse = JSON.parse(body);
          const messageBlock = (apiResponse.output || []).find((item) => item.type === 'message') || (apiResponse.output || [])[0];
          const contentBlocks = messageBlock?.content || [];
          const assistantText = contentBlocks
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n')
            .trim();

          if (status === 200 && assistantText) {
            record.record[config.replyField].value = assistantText;
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
            console.error('Unexpected response payload:', apiResponse);
          }
          console.log('レスポンスヘッダー:', responseHeaders);
        },
        (error) => {
          notification.text = 'API通信中にエラーが発生しました。';
          setTimeout(() => {
            notification.close();
          }, 2000);
          console.error('API通信中にエラーが発生しました:', error);
        }
      );
    });

    return event;
  });
})(kintone.$PLUGIN_ID);
