const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
require('./test_search_browser_core');
require('./generate_page_index');

const ROOT = process.cwd();
const pagePath = path.join(ROOT, 'search', 'index.html');
const scriptPath = path.join(ROOT, 'assets', 'js', 'search-create-tos.js');
const searchCorePath = path.join(ROOT, 'assets', 'js', 'search-browser-core.js');
const collectionCorePath = path.join(ROOT, 'assets', 'js', 'collection-browser-core.js');
const pageIndexPath = path.join(ROOT, 'data', 'page_index.json');
const testPath = path.join(ROOT, 'scripts', 'test_search_browser_core.js');

const requiredControls = [
  'site-search',
  'search-type-filter',
  'search-origin-filter',
  'search-sort',
  'search-reset-filters',
  'search-summary',
  'search-filter-status',
  'search-results'
];

const requiredCopy = [
  'Поиск по сайту',
  'ТОСы',
  'председателей',
  'населённые пункты',
  'новости',
  'материалы',
  'документы',
  'конкурсы',
  'проекты',
  'инструкции по созданию ТОС',
  'Как читать результаты',
  'Подтверждено источником',
  'Редакционный материал',
  'Стартовый материал',
  'Запрос материалов',
  'Фильтры сохраняются в адресе страницы'
];

const requiredManualRoutes = ['/create-tos/', '/documents/templates/tos-creation-kit/', '/tos/', '/update-tos/'];
const requiredOrigins = ['reference', 'verified', 'editorial', 'starter', 'request'];
const requiredGroups = ['tos', 'news', 'projects', 'done', 'needs', 'materials', 'documents', 'places', 'guides', 'other'];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function main() {
  const errors = [];

  [pagePath, scriptPath, searchCorePath, collectionCorePath, pageIndexPath, testPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) throw new Error(`Search content audit failed:\n${errors.join('\n')}`);

  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const searchCore = fs.readFileSync(searchCorePath, 'utf8');
  const pageIndex = JSON.parse(fs.readFileSync(pageIndexPath, 'utf8'));

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);

  if (!title.includes('Поиск') || !title.includes('ТОС БГО')) {
    errors.push('search title must identify site search for TOS BGO');
  }
  if (description.length < 100 || !description.includes('каталогу ТОС') || !description.includes('происхождению материала')) {
    errors.push('search description must cover catalog search and origin filters');
  }
  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/search/"')) {
    errors.push('missing canonical link for search page');
  }
  if (!html.includes('data-search-browser-version="2026-07-22"')) {
    errors.push('search browser version marker is missing');
  }

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing search control #${id}`);
    if (!script.includes(`#${id}`)) errors.push(`search script does not use #${id}`);
  });

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) errors.push(`search page is missing copy: ${copy}`);
  });

  const scriptOrder = [
    '/assets/js/collection-browser-core.js',
    '/assets/js/search-browser-core.js',
    '/assets/js/search-create-tos.js'
  ].map((value) => html.indexOf(value));
  if (scriptOrder.some((index) => index < 0) || !(scriptOrder[0] < scriptOrder[1] && scriptOrder[1] < scriptOrder[2])) {
    errors.push('search browser scripts must load in dependency order');
  }

  requiredManualRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`manual search route is missing: ${route}`);
    if (!script.includes(`url: '${route}'`)) errors.push(`quick search route is not included: ${route}`);
  });

  [
    'Как создать ТОС в Борисоглебском городском округе',
    'Документы для создания ТОС',
    'Найти свой ТОС',
    'Сообщить исправление'
  ].forEach((titleText) => {
    if (!script.includes(titleText)) errors.push(`quick search title is missing: ${titleText}`);
  });

  if (!script.includes("fetch('/data/page_index.json'")) errors.push('search script must load data/page_index.json');
  if (!script.includes("const fields = ['q', 'type', 'origin', 'sort']")) errors.push('search URL state fields are incomplete');
  if (!script.includes('CollectionCore.parseState(window.location.search, fields)')) errors.push('search must restore state from URL');
  if (!script.includes('CollectionCore.syncUrl(state, fields)')) errors.push('search must persist state to URL');
  if (!script.includes("event.key === 'Escape'")) errors.push('Escape search clearing is missing');
  if (!script.includes('data-content-origin=')) errors.push('search result cards must expose content origin');
  if (!script.includes('SearchCore.filterPages')) errors.push('search script must use testable filtering core');
  if (!script.includes('SearchCore.countOrigins')) errors.push('search summary must use origin counts');
  if (!script.includes('new URL(url, window.location.origin).pathname')) errors.push('indexed absolute URLs must become local paths');
  if (!script.includes("replace(/[&<>\"']/g")) errors.push('search script must escape HTML-sensitive characters');
  if (!script.includes('Ничего не найдено. Измените запрос или сбросьте фильтры.')) errors.push('search empty state is missing');
  if (!script.includes('Активных фильтров')) errors.push('accessible active-filter status is missing');

  ['scorePage', 'filterPages', 'countOrigins', 'availableGroups', "replace(/ё/g, 'е')"].forEach((marker) => {
    if (!searchCore.includes(marker)) errors.push(`search browser core is missing ${marker}`);
  });

  if (!Array.isArray(pageIndex.pages) || pageIndex.pages.length < 20) {
    errors.push('page_index.json must contain searchable pages');
  }
  if (!pageIndex.search_groups || typeof pageIndex.search_groups !== 'object') {
    errors.push('page_index.json must expose search_groups');
  }

  const originCounts = Object.fromEntries(requiredOrigins.map((origin) => [origin, 0]));
  const groups = new Set();
  (pageIndex.pages || []).forEach((page, index) => {
    if (!requiredOrigins.includes(page.content_origin)) {
      errors.push(`indexed page ${index + 1} has invalid content_origin ${page.content_origin}`);
    } else {
      originCounts[page.content_origin] += 1;
    }
    if (!requiredGroups.includes(page.search_group)) {
      errors.push(`indexed page ${index + 1} has invalid search_group ${page.search_group}`);
    } else {
      groups.add(page.search_group);
    }
  });

  requiredOrigins.forEach((origin) => {
    if (originCounts[origin] < 1) errors.push(`search index must contain at least one ${origin} result`);
  });
  requiredGroups.forEach((group) => {
    if (!groups.has(group)) errors.push(`search index must contain group ${group}`);
  });

  if (!html.includes('role="status"') || !html.includes('aria-live="polite"')) {
    errors.push('search result status must be accessible');
  }
  if (!html.includes('data-action="menu"') || !html.includes('data-action="theme"')) {
    errors.push('search page must keep menu and theme controls');
  }

  if (errors.length) throw new Error(`Search content audit failed:\n${errors.join('\n')}`);
  console.log(`Search content OK: ${pageIndex.pages.length} indexed pages with group and origin filters`);
}

main();
