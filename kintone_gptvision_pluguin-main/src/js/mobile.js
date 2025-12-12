(function(PLUGIN_ID) {
  const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
  const pluginId = PLUGIN_ID;

  const url = 'https://api.openai.com/v1/responses';
  const method = 'POST';
  const headers = {
    'Content-Type': 'application/json'
  };

  const defaultModel = 'gpt-5.2';
  const defaultReasoning = 'none';
  const baseReasoningOptions = ['none', 'low', 'medium', 'high', 'xhigh'];
  const reasoningLimitsByModel = {
    'gpt-5.2-pro': ['medium', 'high', 'xhigh'],
    'gpt-5.1': ['none', 'low', 'medium', 'high'],
    'gpt-5.1-chat-latest': ['none', 'low', 'medium', 'high']
  };
  const safeModel = config.model || defaultModel;
  const normalizeReasoningEffort = (model, effort) => {
    const normalized = effort === 'minimal' ? 'none' : (effort || defaultReasoning);
    const allowed = reasoningLimitsByModel[model] || baseReasoningOptions;
    if (allowed.includes(normalized)) return normalized;
    if (allowed.includes(defaultReasoning)) return defaultReasoning;
    return allowed[0];
  };
  const safeReasoning = normalizeReasoningEffort(safeModel, config.reasoningEffort);
  const safeSystem = config.role || 'You are a helpful assistant.';
  const extractAssistantText = (resp) => {
    if (typeof resp.output_text === 'string' && resp.output_text.trim()) {
      return resp.output_text.trim();
    }

    const out = Array.isArray(resp.output) ? resp.output : [];
    const msg =
      [...out].reverse().find((x) => x?.type === 'message' && x?.role === 'assistant') ||
      out.find((x) => x?.type === 'message');

    const parts = Array.isArray(msg?.content) ? msg.content : [];
    return parts
      .filter((p) => p && (p.type === 'output_text' || p.type === 'text'))
      .map((p) => p.text)
      .join('\n')
      .trim();
  };

  kintone.events.on(['mobile.app.record.create.show', 'mobile.app.record.edit.show'], function(event) {
    const spaceElement = kintone.mobile.app.record.getSpaceElement(config.spaceId);

    const button = new Kuc.MobileButton({
      text: 'AIに問い合わせ',
      type: 'submit',
      className: 'options-class',
      id: 'options-id',
      visible: true,
      disabled: false
    });

    spaceElement.appendChild(button);

    const notification = new Kuc.MobileNotification({
      text: 'リクエスト中です。しばらくお待ちください。',
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
        reasoning: { effort: safeReasoning },
        stream: false
      };

      notification.text = 'リクエスト中です。しばらくお待ちください。';
      notification.open();

      await kintone.plugin.app.proxy(
        pluginId,
        url,
        method,
        headers,
        JSON.stringify(requestData),
        (body, status, responseHeaders) => {
          const apiResponse = JSON.parse(body);
          const assistantText = extractAssistantText(apiResponse);

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
