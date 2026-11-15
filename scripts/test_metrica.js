'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../assets/js/analytics-core');
const { normalize, allowed } = require('./sync_metrica');
const now = Date.now();
const granted = C.serializeChoice('granted', now - 1000);
const denied = C.serializeChoice('denied', now - 1000);
const prod = { protocol: 'https:', hostname: C.host, pathname: '/grants/', search: '?q=private-contact&code=secret', hash: '#private-draft' };
for (const path of ['/admin/', '/culinary-battle/', '/update-tos/', '/workbench/', '/map/editor/', '/documents/templates/project-kit/', '/grant-application-kit/', '/404.html']) {
  assert.equal(C.eligible({ ...prod, pathname: path }, false), false, path);
}
assert(C.eligible(prod, false));
assert(!C.eligible({ ...prod, hostname: '127.0.0.1' }, false));
assert(!C.eligible({ ...prod, hostname: 'tosborisoglebsk.ru.attacker.test' }, false));
assert(!C.eligible(prod, true));
assert.equal(C.pageUrl(prod), 'https://tosborisoglebsk.ru/grants/');
assert.equal(C.referrer('https://example.org/private-person?phone=secret#draft'), 'https://example.org/');
assert.equal(C.referrer('https://tosborisoglebsk.ru/update-tos/?code=secret'), '');
assert.equal(C.referrer('https://tosborisoglebsk.ru/tos/?q=secret#draft'), 'https://tosborisoglebsk.ru/tos/');
assert.equal(C.referrer('javascript:alert(1)'), '');
for (const value of ['bad', '{}', 'null', C.serializeChoice('granted', now + 1), C.serializeChoice('granted', now - C.lifetime)]) assert.equal(C.readChoice(value, now), null);
assert.equal(C.readChoice(granted, now), 'granted');
assert.equal(C.readChoice(denied, now), 'denied');

function run({ stored = null, location = prod, noindex = false, signal = false, blockedStorage = false } = {}) {
  const requests = [], calls = [], events = {}, writes = [], buttons = [], rootEvents = {};
  let reloads = 0;
  const style = { setProperty() {}, removeProperty() {} };
  function element(tag) {
    return { tag, dataset: {}, style, isConnected: true, setAttribute() {}, appendChild(e) { requests.push(e); },
      remove() { this.isConnected = false; }, getBoundingClientRect() { return { height: 170 }; },
      querySelectorAll() { return buttons; },
      set innerHTML(_) {
        buttons.push(...['denied', 'granted'].map(choice => ({ dataset: { choice }, addEventListener(_, fn) { this.click = fn; } })));
      } };
  }
  const doc = { readyState: 'complete', documentElement: { dataset: {}, style },
    querySelector(s) { return s === 'meta[name="robots"]' && noindex ? { content: 'noindex,nofollow' } : null; },
    querySelectorAll() { return []; }, createElement: element, head: element('head'), body: { appendChild() {} },
    addEventListener(name, fn) { events[name] = fn; }, referrer: 'https://example.org/person?phone=secret' };
  const window = { TosAnalytics: C, location: { ...location, reload() { reloads++; }, replace() { reloads++; } },
    ym(...args) { calls.push(args); }, addEventListener(name, fn) { rootEvents[name] = fn; } };
  const storage = { getItem() { if (blockedStorage) throw Error('blocked'); return stored; },
    setItem(key, value) { if (blockedStorage) throw Error('blocked'); writes.push([key, value]); } };
  const context = vm.createContext({ window, document: doc, navigator: { doNotTrack: signal ? '1' : '0' }, localStorage: storage, URLSearchParams, Date });
  const source = fs.readFileSync('assets/js/analytics.js', 'utf8');
  vm.runInContext(source, context);
  return { requests, calls, events, buttons, rootEvents, writes, doc, rerun() { vm.runInContext(source, context); }, reloads: () => reloads };
}
for (const options of [{}, { stored: denied }, { stored: granted, signal: true }, { stored: granted, noindex: true }, { stored: granted, location: { ...prod, hostname: 'localhost' } }, { stored: granted, location: { ...prod, pathname: '/culinary-battle/' } }, { blockedStorage: true }]) {
  const result = run(options);
  assert.equal(result.requests.length, 0, JSON.stringify(options));
  assert.equal(result.calls.length, 0);
}
const initial = run();
initial.buttons.find(b => b.dataset.choice === 'denied').click();
assert.equal(initial.requests.length, 0);
assert.equal(initial.writes.length, 1);
const accept = run();
accept.buttons.find(b => b.dataset.choice === 'granted').click();
assert.equal(accept.requests.length, 1);
assert.equal(accept.calls.length, 2, 'one init and exactly one pageview');
const active = run({ stored: granted });
assert.equal(active.requests.length, 1);
assert.equal(active.requests[0].referrerPolicy, 'origin');
assert.match(active.requests[0].src, /^https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=114258941$/);
assert.equal(active.calls[0][1], 'init');
for (const key of ['webvisor', 'clickmap', 'trackLinks', 'trackHash', 'ecommerce', 'sendTitle', 'childIframe']) assert.equal(active.calls[0][2][key], false, key);
assert.equal(active.calls[0][2].disableYtm, true);
assert.equal(active.calls[0][2].defer, true);
assert.equal(active.calls[1][1], 'hit');
assert.equal(active.calls[1][2], 'https://tosborisoglebsk.ru/grants/');
assert(!JSON.stringify(active.calls).includes('secret'));
assert(!JSON.stringify(active.calls).includes('private'));
active.events['yacounter114258941inited']();
assert.equal(active.doc.documentElement.dataset.analyticsState, 'active');
active.rerun();
assert.equal(active.requests.length, 1, 'bootstrap is idempotent');
active.rootEvents.storage({ key: C.storageKey, newValue: denied });
assert.equal(active.reloads(), 1, 'revocation in another tab stops loaded code by reload');
assert.equal(active.writes.length, 0, 'storage events never echo writes between tabs');
const other = run({ stored: denied });
other.rootEvents.storage({ key: C.storageKey, newValue: granted });
assert.equal(other.requests.length, 1);
assert.equal(other.writes.length, 0);
const html = '<html><head><title>test</title></head><body></body></html>';
const synced = normalize(html, 'index.html');
assert.equal(normalize(synced, 'index.html'), synced);
assert.equal(normalize(synced, 'update-tos/index.html'), html);
assert(!allowed('admin/index.html', html));
assert(!allowed('index.html', '<meta name="robots" content="noindex">'));
assert(!synced.includes('mc.yandex.ru'), 'HTML must not request Yandex before consent');
console.log('Metrica OK: opt-in, refusal, expiry, private/preview exclusions, sanitized URLs, blocked storage, one pageview and cross-tab withdrawal');
