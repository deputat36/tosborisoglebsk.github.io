const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'search', 'index.html');
const scriptPath = path.join(process.cwd(), 'assets', 'js', 'search-create-tos.js');
const pageIndexPath = path.join(process.cwd(), 'data', 'page_index.json');

const requiredControls = ['site-search', 'search-results'];
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
  'инструкции по созданию ТОС'
];
const requiredManualRoutes = ['/create-tos/', '/documents/templates/tos-creation-kit/'];
const requiredManualTitles = [
  'Как создать ТОС в Борисоглебском городском округе',
  'Документы для создания ТОС'
];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function main() {
  const errors = [];

  [pagePath, scriptPath, pageIndexPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Search content audit failed:\n${errors.join('\n')}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const pageIndex = JSON.parse(fs.readFileSync(pageIndexPath, 'utf8'));

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);

  if (!title.includes('Поиск') || !title.includes('ТОС БГО')) {
    errors.push('search title must identify site search for TOS BGO');
  }

  if (description.length < 70 || !description.includes('каталогу ТОС') || !description.includes('проектам')) {
    errors.push('search description must cover catalog and project search');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/search/"')) {
    errors.push('missing canonical link for search page');
  }

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing search control #${id}`);
    if (!script.includes(`#${id}`)) errors.push(`search script does not use #${id}`);
  });

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) errors.push(`search page is missing copy: ${copy}`);
  });

  if (!html.includes('/assets/js/search-create-tos.js')) {
    errors.push('search page must include search-create-tos.js');
  }

  if (!repoPathExists('/assets/js/search-create-tos.js')) {
    errors.push('search script file is missing');
  }

  if (!script.includes("fetch('/data/page_index.json'")) {
    errors.push('search script must load data/page_index.json');
  }

  if (!Array.isArray(pageIndex.pages) || pageIndex.pages.length < 20) {
    errors.push('page_index.json must contain searchable pages');
  }

  requiredManualRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`manual search route is missing: ${route}`);
    if (!script.includes(`url: '${route}'`)) errors.push(`manual search route is not included: ${route}`);
  });

  requiredManualTitles.forEach((titleText) => {
    if (!script.includes(titleText)) errors.push(`manual search title is missing: ${titleText}`);
  });

  if (!script.includes("replace(/ё/g, 'е')")) {
    errors.push('search script must normalize ё to е');
  }

  if (!script.includes("replace(/[&<>\"']/g")) {
    errors.push('search script must escape HTML-sensitive characters');
  }

  if (!script.includes('new URL(url).pathname')) {
    errors.push('search script must convert indexed absolute URLs to local paths');
  }

  if (!script.includes('const seen = new Set()')) {
    errors.push('search script must deduplicate results');
  }

  if (!script.includes("input.addEventListener('input'")) {
    errors.push('search script must react to input changes');
  }

  if (!html.includes('data-action="menu"') || !html.includes('data-action="theme"')) {
    errors.push('search page must keep menu and theme controls');
  }

  if (errors.length) {
    throw new Error(`Search content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Search content OK: ${pageIndex.pages.length} indexed pages`);
}

main();
