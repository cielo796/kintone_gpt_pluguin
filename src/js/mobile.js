(function (PLUGIN_ID) {
  // eslint-disable-next-line strict -- kintone loads this file as a classic script.
  'use strict';
  window.kintoneGptPlugins[PLUGIN_ID].start({
    recordApi: kintone.mobile.app.record,
    getAppId: () => kintone.mobile.app.getId(),
    prefix: 'mobile.app',
    isMobile: true,
    getHeaderSpace: () => kintone.mobile.app.getHeaderSpaceElement(),
  });
})(kintone.$PLUGIN_ID);
