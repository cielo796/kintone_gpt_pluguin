(function(PLUGIN_ID) {
  const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
  const pluginId = PLUGIN_ID;

  // Responses API向け（最新モデル想定）に対応
  const url = 'https://api.openai.com/v1/responses';
  const method = 'POST';
  const headers = {
    'Content-Type': 'application/json'
  };

  // Default to the current flagship model in the GPT-5.6 family.
  const defaultModel = 'gpt-5.6-sol';
  const supportedModels = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5'];
  const defaultReasoning = 'medium';
  const defaultReasoningByModel = {
    'gpt-5.6-sol': 'medium',
    'gpt-5.6-terra': 'medium',
    'gpt-5.6-luna': 'medium',
    'gpt-5.5': 'medium'
  };
  const gpt55ReasoningOptions = ['none', 'low', 'medium', 'high', 'xhigh'];
  const gpt56ReasoningOptions = [...gpt55ReasoningOptions, 'max'];
  const reasoningLimitsByModel = {
    'gpt-5.6-sol': gpt56ReasoningOptions,
    'gpt-5.6-terra': gpt56ReasoningOptions,
    'gpt-5.6-luna': gpt56ReasoningOptions,
    'gpt-5.5': gpt55ReasoningOptions
  };
  const resolveModel = (model) => supportedModels.includes(model) ? model : defaultModel;
  const safeModel = resolveModel(config.model);
  const getDefaultReasoning = (model) => defaultReasoningByModel[model] || defaultReasoning;
  const normalizeReasoningEffort = (model, effort) => {
    const defaultEffort = getDefaultReasoning(model);
    const normalized = effort === 'minimal' ? 'none' : (effort || defaultEffort);
    const allowed = reasoningLimitsByModel[model] || gpt55ReasoningOptions;
    if (allowed.includes(normalized)) return normalized;
    if (allowed.includes(defaultEffort)) return defaultEffort;
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

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {
    const spaceElement = kintone.app.record.getSpaceElement(config.spaceId);

    const button = new Kuc.Button({
      text: 'AIに問い合わせ',
      type: 'submit',
      className: 'options-class',
      id: 'options-id',
      visible: true,
      disabled: false
    });

    spaceElement.appendChild(button);

    const notification = new Kuc.Notification({
      text: 'リクエスト中です。しばらくお待ちください。',
      duration: -1, // 自動的には閉じない
      className: 'notification-class'
    });

    button.addEventListener('click', async () => {
      const record = kintone.app.record.get();
      const content = record.record[config.contentField]?.value || '';

      // 入力が空の場合は通知だけを出す
      if (!content.trim()) {
        notification.text = '入力フィールドが空です。内容を入力してください。';
        notification.open();
        setTimeout(() => notification.close(), 2000);
        return;
      }

      const requestData = {
        model: safeModel,
        instructions: safeSystem,
        input: content,
        reasoning: { effort: safeReasoning }
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
            kintone.app.record.set(record);
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
