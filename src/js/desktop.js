(function(PLUGIN_ID) {
  'use strict';
  window.kintoneGptPlugins[PLUGIN_ID].start({
    recordApi: kintone.app.record,
    getAppId: () => kintone.app.getId(),
    prefix: 'app',
    Button: Kuc.Button,
    Notification: Kuc.Notification
  });
})(kintone.$PLUGIN_ID);
