(function (PLUGIN_ID) {
  // eslint-disable-next-line strict -- kintone loads this file as a classic script.
  'use strict';
  window.kintoneGptPlugins[PLUGIN_ID].start({
    recordApi: kintone.app.record,
    getAppId: () => kintone.app.getId(),
    prefix: 'app',
    isMobile: false,
    getHeaderSpace: () => kintone.app.record.getHeaderMenuSpaceElement(),
  });
})(kintone.$PLUGIN_ID);
