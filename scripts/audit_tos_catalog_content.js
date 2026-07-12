const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'tos', 'index.html');
const scriptPath = path.join(process.cwd(), 'assets', 'js', 'tos-catalog.js');
const stylePath = path.join(process.cwd(), 'assets', 'css', 'tos-catalog.css');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');

const requiredControls = [
  'catalog',
  'tos-count',
  'search',
  'location-filter',
  'type-filter',
  'trust-filter',
  'tos-summary',
  'tos-list'
];
const removedControls = ['contact-filter', 'activity-filter', 'fill-filter', 'sort-filter'];
const requiredRoutes = ['/update-tos/', '/contacts/', '/sections/'];
const requiredCopy = [
  'Каталог ТОС',
  'Найдите свой ТОС',
  'Каталог пополняется и уточняется',
  'Не знаете, к какому ТОСу относитесь?',
  'Поиск использует только опубликованные сведения',
  'Статус проверки'
];
const requiredFallbackSlugs = ['bogana', 'vostochnyy', 'gubari', 'ivanovka', 'podstepki', 'uyutnyy'];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function main() {
  const errors = [];

  [pagePath, scriptPath, stylePath, tosesPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`TOS catalog content audit failed:\n${errors.join('\n')}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const css = fs.readFileSync(stylePath, 'utf8');
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const publishedToses = Array.isArray(toses) ? toses.filter((item) => item && item.status !== 'draft') : [];

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);

  if (!title.includes('Каталог ТОС') || !title.includes('Борисоглебского')) {
    errors.push('catalog title must identify TOS catalog for Borisoglebsk district');
  }

  if (description.length < 120 || !description.includes('по названию') || !description.includes('проектам')) {
    errors.push('catalog description must cover search fields and related materials');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/tos/"')) {
    errors.push('missing canonical link for TOS catalog');
  }

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) errors.push(`catalog page is missing copy: ${copy}`);
  });

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing catalog control #${id}`);
  });

  removedControls.forEach((id) => {
    if (html.includes(`id="${id}"`)) errors.push(`obsolete catalog control must be removed: #${id}`);
  });

  if (!html.includes('/assets/css/tos-catalog.css')) {
    errors.push('catalog page must include tos-catalog.css');
  }

  if (!html.includes('/assets/js/tos-catalog.js')) {
    errors.push('catalog page must include tos-catalog.js');
  }

  if (!html.includes('/assets/js/tos-logos.js')) {
    errors.push('catalog page must include tos-logos.js');
  }

  requiredRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`linked route does not exist: ${route}`);
    if (!html.includes(`href="${route}`)) errors.push(`catalog page does not link to ${route}`);
  });

  if (html.includes('href="/map/"')) {
    errors.push('catalog page must not promote an empty geodata map');
  }

  const heroMatch = html.match(/<div class="hero-actions">([\s\S]*?)<\/div>/);
  const heroLinks = heroMatch ? Array.from(heroMatch[1].matchAll(/href="([^"]+)"/g), (match) => match[1]) : [];
  if (heroLinks.length !== 2 || heroLinks[0] !== '#catalog' || heroLinks[1] !== '/contacts/') {
    errors.push(`catalog hero must contain only #catalog and /contacts/, found: ${heroLinks.join(', ')}`);
  }

  const staticCount = Number(textMatch(html, /<b id="tos-count">(\d+)<\/b>/));
  if (!Number.isInteger(staticCount) || staticCount !== publishedToses.length) {
    errors.push(`catalog static count must match data/toses.json: ${staticCount} !== ${publishedToses.length}`);
  }

  requiredFallbackSlugs.forEach((slug) => {
    if (!repoPathExists(`/tos/${slug}/`)) errors.push(`fallback card route is missing: /tos/${slug}/`);
    if (!html.includes(`/tos/${slug}/`)) errors.push(`noscript fallback is missing slug ${slug}`);
  });

  if (!script.includes("fetch('/data/toses.json'")) {
    errors.push('catalog script must fetch data/toses.json');
  }

  ['/data/news.json', '/data/projects.json', '/data/done.json', '/data/needs.json'].forEach((dataPath) => {
    if (script.includes(`fetch('${dataPath}'`)) errors.push(`catalog script must not fetch unrelated collection ${dataPath}`);
  });

  if (!script.includes('replace(/ё/g')) {
    errors.push('catalog script must normalize ё in search text');
  }

  if (!script.includes("replace(/[&<>'\"]/g")) {
    errors.push('catalog script must escape HTML-sensitive characters');
  }

  if (!script.includes('function apply()')) {
    errors.push('catalog script must have a filter apply function');
  }

  ['verified', 'partial', 'needs_review', 'stale'].forEach((status) => {
    if (!html.includes(`value="${status}"`) || !script.includes(`'${status}'`)) {
      errors.push(`catalog trust filter is missing status: ${status}`);
    }
  });

  ['verificationStatus', 'verificationInfo', 'verificationNote'].forEach((helper) => {
    if (!script.includes(helper)) errors.push(`catalog trust helper is missing: ${helper}`);
  });

  if (!script.includes('Источник, дата и объём проверки не зафиксированы.')) {
    errors.push('catalog cards must disclose missing verification evidence');
  }

  if (!script.includes('Открыть карточку') || !script.includes('/update-tos/?type=card#message-builder')) {
    errors.push('catalog cards must keep one primary open action and an inline correction route');
  }

  if (script.includes('Заполнено') || script.includes('activityFor') || script.includes('activityBadges')) {
    errors.push('catalog cards must not use completeness or unverified activity as the primary signal');
  }

  ['tos-toolbar', 'improved-tos-card', 'feature-row', 'summary-grid'].forEach((selector) => {
    if (!css.includes(selector)) errors.push(`catalog CSS is missing selector ${selector}`);
  });

  if (!html.includes('data-action="menu"') || !html.includes('data-action="theme"')) {
    errors.push('catalog page must keep menu and theme controls');
  }

  if (errors.length) {
    throw new Error(`TOS catalog content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`TOS catalog content OK: ${publishedToses.length} published cards with focused search and trust status`);
}

main();
