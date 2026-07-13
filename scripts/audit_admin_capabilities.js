const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const ADMIN_DIR = path.join(ROOT, 'admin');
const INDEX_PATH = path.join(ADMIN_DIR, 'index.html');
const INVENTORY_PATH = path.join(ROOT, 'data', 'admin_capability_inventory.csv');
const DOC_PATH = path.join(ROOT, 'docs', 'ADMIN-AUDIT-2026-07-13.md');

const requiredFiles = [
  'admin/index.html',
  'admin/admin.css',
  'admin/admin2.js',
  'admin/admin-logo-tools.js',
  'admin/admin-dashboard.js',
  'admin/admin-export-tools.js',
  'admin/admin-history.js',
  'data/admin_capability_inventory.csv',
  'docs/ADMIN-AUDIT-2026-07-13.md'
];

const forbiddenFiles = [
  'admin/admin-index-ready.html',
  'admin/admin.js',
  'admin/admin-logo-bulk.js',
  'admin/admin-mass-autofill.js',
  'admin/admin-mass-fill-all.js',
  'admin/admin-mass-all-autofill.js'
];

const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];

const expectedHeaders = [
  'capability_id',
  'area',
  'requirement',
  'status',
  'implementation',
  'evidence',
  'risk',
  'next_step'
];

const allowedStatuses = new Set(['done', 'partial', 'intentionally_excluded', 'planned']);
const requiredCapabilities = new Set(Array.from({ length: 12 }, (_, index) => `admin-${String(index + 1).padStart(3, '0')}`));

function normalize(value){
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function requireTokens(text, tokens, errors, context){
  tokens.forEach(token => {
    if(!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

function localEvidenceExists(value){
  return fs.existsSync(path.join(ROOT, value.replace(/^\/+/, '')));
}

function main(){
  const errors = [];

  requiredFiles.forEach(file => {
    if(!fs.existsSync(path.join(ROOT, file))) errors.push(`missing required admin file ${file}`);
  });
  forbiddenFiles.forEach(file => {
    if(fs.existsSync(path.join(ROOT, file))) errors.push(`obsolete admin file must be removed ${file}`);
  });

  if(errors.length) throw new Error(`Admin capability audit failed:\n${errors.join('\n')}`);

  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const admin2 = fs.readFileSync(path.join(ADMIN_DIR, 'admin2.js'), 'utf8');
  const logoTools = fs.readFileSync(path.join(ADMIN_DIR, 'admin-logo-tools.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(ADMIN_DIR, 'admin-dashboard.js'), 'utf8');
  const exportTools = fs.readFileSync(path.join(ADMIN_DIR, 'admin-export-tools.js'), 'utf8');
  const history = fs.readFileSync(path.join(ADMIN_DIR, 'admin-history.js'), 'utf8');
  const docText = fs.readFileSync(DOC_PATH, 'utf8');

  if(!indexHtml.includes('<meta name="robots" content="noindex,nofollow"')) {
    errors.push('admin page must remain noindex,nofollow');
  }
  requireTokens(indexHtml, [
    'Эта админка не записывает данные прямо в GitHub',
    'Прямая запись в GitHub намеренно не используется',
    '/admin/admin-export-tools.js',
    '/admin/admin-history.js'
  ], errors, 'admin index');

  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  if(scripts.length !== expectedScripts.length) {
    errors.push(`admin index must contain exactly ${expectedScripts.length} scripts, found ${scripts.length}`);
  }
  if(new Set(scripts).size !== scripts.length) errors.push('admin index contains duplicate scripts');
  expectedScripts.forEach(script => {
    if(!scripts.includes(script)) errors.push(`admin index is missing supported script ${script}`);
  });
  scripts.forEach(script => {
    if(!expectedScripts.includes(script)) errors.push(`admin index includes unsupported script ${script}`);
  });

  requireTokens(admin2, [
    'localStorage.setItem',
    'function slugify',
    "['published','Опубликованные']",
    "['draft','Черновики']",
    "['low','Заполнено менее 70%']",
    "['linked','Привязаны к ТОС']",
    'function validate()',
    'function audit()',
    'function downloadJson()',
    'function downloadAll()',
    'function importJson(file)',
    'id="previewBox"',
    'function preview'
  ], errors, 'admin editor');

  requireTokens(logoTools, [
    'bulkFillLogoPaths',
    'downloadNoLogoCsv',
    "option value=\"no-logo\"",
    '/assets/img/tos-logos/'
  ], errors, 'admin logo tools');

  requireTokens(dashboard, [
    'Обзор сайта',
    'Что исправить в первую очередь',
    'CSV председателей',
    'Проекты без ТОС',
    'Документ без ссылки'
  ], errors, 'admin dashboard');

  requireTokens(exportTools, [
    'CSV текущего списка',
    'function visibleItems()',
    'function exportFilteredCsv()',
    'admin-${state.section}-filtered-${date}.csv'
  ], errors, 'admin export tools');

  requireTokens(history, [
    'MAX_SNAPSHOTS = 10',
    'Создать снимок',
    'Откатить',
    'before-restore',
    'AUTO_SNAPSHOT_IDS',
    'localStorage.setItem'
  ], errors, 'admin history');

  const adminJsFiles = fs.readdirSync(ADMIN_DIR)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(ADMIN_DIR, name));
  const forbiddenPatterns = [
    /github_pat_/i,
    /ghp_[a-z0-9]/i,
    /api\.github\.com/i,
    /authorization\s*:/i,
    /bearer\s+[a-z0-9]/i,
    /localStorage[^\n]{0,80}token/i,
    /sessionStorage[^\n]{0,80}token/i
  ];
  adminJsFiles.forEach(filePath => {
    const text = fs.readFileSync(filePath, 'utf8');
    forbiddenPatterns.forEach(pattern => {
      if(pattern.test(text)) errors.push(`admin client code must not contain credential/API pattern ${pattern} in ${path.relative(ROOT, filePath)}`);
    });
  });

  const rows = parseCsv(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  const headers = (rows[0] || []).map(normalize);
  if(headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected admin capability headers: ${headers.join(', ')}`);
  }
  if(rows.length !== 13) errors.push(`admin capability inventory must contain 12 rows, found ${Math.max(0, rows.length - 1)}`);

  const seenIds = new Set();
  rows.slice(1).forEach((row, index) => {
    const line = `admin capability row ${index + 2}`;
    const values = expectedHeaders.map((_, columnIndex) => normalize(row[columnIndex]));
    const [id, area, requirement, status, implementation, evidence, risk, nextStep] = values;

    if(!/^admin-\d{3}$/.test(id)) errors.push(`${line}: invalid capability_id ${id}`);
    if(seenIds.has(id)) errors.push(`${line}: duplicate capability_id ${id}`);
    if(id) seenIds.add(id);
    if(!area || !requirement || !implementation || !risk || !nextStep) errors.push(`${line}: required text field is empty`);
    if(!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if(!evidence) errors.push(`${line}: missing evidence`);

    evidence.split(';').map(normalize).filter(Boolean).forEach(item => {
      if(!/^https:\/\//i.test(item) && !localEvidenceExists(item)) {
        errors.push(`${line}: evidence path does not exist ${item}`);
      }
    });
  });

  requiredCapabilities.forEach(id => {
    if(!seenIds.has(id)) errors.push(`missing required admin capability ${id}`);
  });

  const publishingRow = rows.slice(1).find(row => normalize(row[0]) === 'admin-010');
  if(!publishingRow || normalize(publishingRow[3]) !== 'intentionally_excluded') {
    errors.push('direct GitHub publishing must remain intentionally_excluded');
  }

  requireTokens(docText, [
    'data/admin_capability_inventory.csv',
    'admin/admin-export-tools.js',
    'admin/admin-history.js',
    'не обращается к GitHub API',
    'Удалённые дубли'
  ], errors, 'admin audit documentation');

  if(errors.length) {
    throw new Error(`Admin capability audit failed:\n${errors.join('\n')}`);
  }

  const statusCounts = rows.slice(1).reduce((result, row) => {
    const status = normalize(row[3]);
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  console.log(`Admin capability audit OK: ${rows.length - 1} capabilities, ${JSON.stringify(statusCounts)}`);
}

main();
