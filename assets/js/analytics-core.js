(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TosAnalytics = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const counterId = 114258941;
  const host = 'tosborisoglebsk.ru';
  const storageKey = 'tos-bgo-analytics-v1';
  const lifetime = 180 * 86400000;
  // These pages can contain local drafts, contact details or participation codes.
  const excluded = /^\/(?:admin|audit|workbench[^/]*|culinary-battle|update-tos|grant-application-kit|documents\/templates|map\/editor)(?:\/|$)/;
  function publicPath(path) {
    return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') &&
      !/[?#\\\r\n]/.test(path) && !excluded.test(path) && path !== '/404.html';
  }
  function eligible(location, noindex) {
    return location.protocol === 'https:' && location.hostname === host && !noindex && publicPath(location.pathname);
  }
  function pageUrl(location) {
    return publicPath(location.pathname) ? 'https://' + host + location.pathname : '';
  }
  function referrer(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return '';
      // Keep the traffic source, but never pass another site's path or query.
      if (url.hostname !== host) return url.origin + '/';
      return publicPath(url.pathname) ? 'https://' + host + url.pathname : '';
    } catch (_) { return ''; }
  }
  function readChoice(value, now) {
    try {
      const item = JSON.parse(value);
      if (item.version !== 1 || !['granted', 'denied'].includes(item.choice) ||
          !Number.isFinite(item.at) || item.at > now || now - item.at >= lifetime) return null;
      return item.choice;
    } catch (_) { return null; }
  }
  function serializeChoice(choice, now) {
    return JSON.stringify({ version: 1, choice, at: now });
  }
  function initOptions(url, source) {
    return { url, referrer: source, defer: true, triggerEvent: true, sendTitle: false,
      clickmap: false, webvisor: false, trackLinks: false, trackHash: false,
      ecommerce: false, disableYtm: true, childIframe: false, accurateTrackBounce: true };
  }
  return { counterId, host, storageKey, lifetime, publicPath, eligible, pageUrl, referrer, readChoice, serializeChoice, initOptions };
});
