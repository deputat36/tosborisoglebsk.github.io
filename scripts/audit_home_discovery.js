const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const files = {
  page: path.join(ROOT, 'index.html'),
  core: path.join(ROOT, 'assets', 'js', 'home-discovery-core.js'),
  ui: path.join(ROOT, 'assets', 'js', 'home-discovery.js'),
  css: path.join(ROOT, 'assets', 'css', 'design-upgrades.css'),
  test: path.join(ROOT, 'scripts', 'test_home_discovery.js')
};

const errors = [];
const read = (key) => {
  if (!fs.existsSync(files[key])) {
    errors.push(`missing ${path.relative(ROOT, files[key])}`);
    return '';
  }
  return fs.readFileSync(files[key], 'utf8');
};
const page = read('page');
const core = read('core');
const ui = read('ui');
const css = read('css');
read('test');

function requireToken(content, token, label) {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
}

[
  'id="home-finder"',
  'id="home-tos-search"',
  'id="home-tos-search-clear"',
  'id="home-tos-search-results"',
  'id="home-current-overview"',
  'Найдите свой ТОС прямо здесь',
  'Что актуально сейчас',
  'Дата технической сборки не считается датой проверки сведений',
  '/assets/js/home-discovery-core.js',
  '/assets/js/home-discovery.js'
].forEach((token) => requireToken(page, token, 'index.html'));

const coreIndex = page.indexOf('/assets/js/home-discovery-core.js');
const uiIndex = page.indexOf('/assets/js/home-discovery.js');
if (!(coreIndex >= 0 && uiIndex > coreIndex)) errors.push('home discovery core must load before UI');
if (!page.includes('aria-live="polite"') || !page.includes('aria-describedby="home-finder-help"')) errors.push('home finder must expose accessible live results and help');
if (page.includes('Ближайшие события и дедлайны')) errors.push('homepage must not restore an unverified showcase heading');

[
  'function searchToses',
  "item.status!=='draft'",
  'function buildCurrentOverview',
  'freshDays=30',
  'verificationStatus'
].forEach((token) => requireToken(core, token, 'home-discovery-core.js'));
if (/phones|emails|social_links|contacts_raw/.test(core)) errors.push('home finder core must not index direct contact fields');

[
  "getJson('/data/toses.json',[])",
  "getJson('/data/events.json',[])",
  "getJson('/data/news.json',[])",
  "getJson('/data/site_health.json',{})",
  'Техническая сборка',
  'Редакционный ориентир',
  'Черновики и неподтверждённые сообщения не выдаются за новости'
].forEach((token) => requireToken(ui, token, 'home-discovery.js'));
if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(ui)) errors.push('home discovery UI must not specify write methods');
if (/\b(?:POST|PUT|PATCH|DELETE|localStorage|sessionStorage|sendBeacon|WebSocket)\b/.test(ui)) errors.push('home discovery UI must remain read-only and storage-free');

[
  '.home-discovery-grid',
  '.home-finder-card',
  '.home-search-result',
  '.home-current-card',
  '.home-current-overview'
].forEach((token) => requireToken(css, token, 'design-upgrades.css'));

if (errors.length) throw new Error(`Home discovery audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
console.log('Home discovery integration OK: read-only finder and current overview');
