(function(PLUGIN_ID) {
  'use strict';
  window.kintoneGptPlugins[PLUGIN_ID].start({
    recordApi: kintone.mobile.app.record,
    getAppId: () => kintone.mobile.app.getId(),
    prefix: 'mobile.app',
    Button: Kuc.MobileButton,
    Notification: Kuc.MobileNotification
  });
})(kintone.$PLUGIN_ID);
