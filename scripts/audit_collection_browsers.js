const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VERSION = '2026-07-22';
const errors = [];

const pages = [
  { key: 'news', page: 'news/index.html', script: 'assets/js/news.js', fields: ['q', 'category', 'tos', 'origin'] },
  { key: 'projects', page: 'projects/index.html', script: 'assets/js/projects.js', fields: ['q', 'type', 'tos', 'origin'] },
  { key: 'done', page: 'done/index.html', script: 'assets/js/done.js', fields: ['q', 'type', 'tos', 'year', 'status', 'origin'] },
  { key: 'needs', page: 'needs/index.html', script: 'assets/js/needs.js', fields: ['q', 'type', 'tos', 'priority', 'status', 'origin'] }
];

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireFragments(label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

pages.forEach((config) => {
  const html = read(config.page);
  const script = read(config.script);
  const corePos = html.indexOf('/assets/js/collection-browser-core.js');
  const pagePos = html.indexOf(`/assets/js/${config.key}.js`);

  requireFragments(config.page, html, [
    `data-collection-browser-version="${VERSION}"`,
    `id="${config.key}-search"`,
    `id="${config.key}-origin-filter"`,
    `id="${config.key}-reset-filters"`,
    `id="${config.key}-summary"`,
    `id="${config.key}-filter-status"`,
    'role="status"',
    'aria-live="polite"',
    '/assets/js/collection-browser-core.js'
  ]);

  if (corePos < 0 || pagePos < 0 || corePos > pagePos) {
    errors.push(`${config.page}: collection core must load before page script`);
  }

  requireFragments(config.script, script, [
    'window.CollectionBrowserCore',
    'parseState(window.location.search',
    'syncUrl(state',
    'activeFilterCount(state)',
    'resetControls(controls)',
    'setStatus(',
    `#${config.key}-origin-filter`,
    `#${config.key}-reset-filters`,
    `#${config.key}-filter-status`,
    'data-content-origin',
    'По выбранным фильтрам'
  ]);

  config.fields.forEach((field) => {
    if (!script.includes(`'${field}'`)) errors.push(`${config.script}: URL state field is missing: ${field}`);
  });
});

const core = read('assets/js/collection-browser-core.js');
requireFragments('collection browser core', core, [
  'module.exports',
  'CollectionBrowserCore',
  'parseState',
  'serializeState',
  'syncUrl',
  'countOrigins',
  'activeFilterCount',
  'aria'
].filter((fragment) => fragment !== 'aria'));

const orchestrator = read('scripts/patch_tos_detail_responsive_styles.js');
requireFragments('patch orchestrator', orchestrator, [
  "require('./patch_collection_browsers')",
  'patchCollectionBrowsers();'
]);

const patcher = read('scripts/patch_collection_browsers.js');
requireFragments('collection browser patcher', patcher, [
  'Collection browser patch OK',
  'data-collection-browser-version',
  'collection-browser-core.js',
  'news-origin-filter',
  'projects-origin-filter',
  'done-origin-filter',
  'needs-origin-filter'
]);

if (errors.length) {
  console.error(`Collection browser audit failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Collection browser audit OK: ${pages.length} collection pages verified`);
