const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'admin', 'index.html');
const INVENTORY_PATH = path.join(ROOT, 'data', 'admin_capability_inventory.csv');
const DOC_PATH = path.join(ROOT, 'docs', 'ADMIN-LOCAL-PRODUCTIVITY.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'admin-local-productivity-audit.yml');

const requiredFiles = [
  'admin/index.html',
  'admin/admin.css',
  'admin/admin2.js',
  'admin/admin-done-dataset.js',
  'admin/admin-logo-tools.js',
  'admin/admin-dashboard.js',
  'admin/admin-export-tools.js',
  'admin/admin-history.js',
  'data/admin_capability_inventory.csv',
  'docs/ADMIN-LOCAL-PRODUCTIVITY.md',
  'scripts/audit_admin_dataset_schema.js'
];

const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-done-dataset.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];

const headers = [
  'capability_id',
  'area',
  'requirement',
  'status',
  'implementation',
  'evidence',
  'risk',
  'next_step'
];

const allowedStatuses = new Set(['done', 'partial', 'intentionally_excluded']);

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function requireTokens(errors, label, text, tokens) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${label} is missing ${token}`);
  }
}

function main() {
  const errors = [];
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(ROOT, relativePath))) errors.push(`missing required file ${relativePath}`);
  }
  if (errors.length) throw new Error(`Admin local productivity audit failed:\n${errors.join('\n')}`);

  const indexHtml = read(INDEX_PATH);
  const core = read(path.join(ROOT, 'admin', 'admin2.js'));
  const done = read(path.join(ROOT, 'admin', 'admin-done-dataset.js'));
  const dashboard = read(path.join(ROOT, 'admin', 'admin-dashboard.js'));
  const exportTools = read(path.join(ROOT, 'admin', 'admin-export-tools.js'));
  const history = read(path.join(ROOT, 'admin', 'admin-history.js'));
  const doc = read(DOC_PATH);

  requireTokens(errors, 'admin index', indexHtml, [
    '<meta name="robots" content="noindex,nofollow"/>',
    "connect-src 'self'",
    'data-section="done"',
    '<code>data/done.json</code>',
    '/admin/admin-done-dataset.js',
    '/admin/admin-export-tools.js',
    '/admin/admin-history.js',
    'Публикация выполняется вручную',
    'Это не защищённая админка'
  ]);

  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(scripts) !== JSON.stringify(expectedScripts)) {
    errors.push(`admin index must contain exactly supported scripts in order: ${expectedScripts.join(', ')}`);
  }

  requireTokens(errors, 'admin core', core, [
    'localStorage.setItem',
    'function current()',
    'function save()',
    'function downloadText',
    'function downloadJson()',
    'async function downloadAll()',
    'function importJson(file)',
    'function filtered()'
  ]);

  requireTokens(errors, 'done editor', done, [
    'DATASETS.done',
    "file: '/data/done.json'",
    "content_origin: 'request'",
    "status: 'draft'",
    'Каких подтверждений не хватает'
  ]);

  requireTokens(errors, 'dashboard', dashboard, [
    "readDataset('done','/data/done.json')",
    'function resultNeedsEvidence',
    'doneNeedsEvidence',
    'Результаты требуют подтверждения',
    'не публикует изменения'
  ]);

  requireTokens(errors, 'CSV export', exportTools, [
    'CSV текущего списка',
    'function visibleItems()',
    'function exportFilteredCsv()',
    'text/csv;charset=utf-8',
    'проверьте, не содержит ли выборка контакты'
  ]);

  requireTokens(errors, 'snapshot history', history, [
    'MAX_SNAPSHOTS = 10',
    'AUTO_SNAPSHOT_IDS',
    'before-restore',
    'Создать снимок',
    'Откатить',
    'history.slice(-MAX_SNAPSHOTS)'
  ]);

  const matrix = parseCsv(read(INVENTORY_PATH));
  const actualHeaders = (matrix[0] || []).map(normalize);
  if (JSON.stringify(actualHeaders) !== JSON.stringify(headers)) {
    errors.push(`unexpected capability headers: ${actualHeaders.join(', ')}`);
  }
  if (matrix.length !== 13) errors.push(`capability inventory must contain 12 rows, found ${Math.max(0, matrix.length - 1)}`);

  const ids = new Set();
  matrix.slice(1).forEach((cells, index) => {
    const values = headers.map((_, column) => normalize(cells[column]));
    const [id, area, requirement, status, implementation, evidence, risk, nextStep] = values;
    const label = `capability row ${index + 2}`;
    if (!/^admin-\d{3}$/.test(id)) errors.push(`${label}: invalid id ${id}`);
    if (ids.has(id)) errors.push(`${label}: duplicate id ${id}`);
    ids.add(id);
    if (!area || !requirement || !implementation || !evidence || !risk || !nextStep) errors.push(`${label}: required field is empty`);
    if (!allowedStatuses.has(status)) errors.push(`${label}: unsupported status ${status}`);
    for (const evidencePath of evidence.split(';').map(normalize).filter(Boolean)) {
      if (!fs.existsSync(path.join(ROOT, evidencePath))) errors.push(`${label}: missing evidence ${evidencePath}`);
    }
  });

  for (let index = 1; index <= 12; index += 1) {
    const id = `admin-${String(index).padStart(3, '0')}`;
    if (!ids.has(id)) errors.push(`missing capability ${id}`);
  }

  for (const id of ['admin-010', 'admin-011']) {
    const row = matrix.slice(1).find((cells) => normalize(cells[0]) === id);
    if (!row || normalize(row[3]) !== 'intentionally_excluded') {
      errors.push(`${id} must remain intentionally_excluded`);
    }
  }

  requireTokens(errors, 'productivity documentation', doc, [
    'девятью открытыми наборами',
    'до 10 снимков',
    'перед восстановлением старого состояния',
    'не отправляет данные по сети',
    'прямой commit или push из браузера запрещён',
    'external network targets должны оставаться равными 0'
  ]);

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scriptsContract = packageJson.scripts || {};
  if (scriptsContract['audit:admin-productivity'] !== 'node scripts/audit_admin_local_productivity.js') {
    errors.push('package.json must define audit:admin-productivity');
  }
  if (scriptsContract['audit:admin-schema'] !== 'node scripts/audit_admin_dataset_schema.js') {
    errors.push('package.json must define audit:admin-schema');
  }
  if (!String(scriptsContract['audit:all'] || '').includes('npm run audit:admin-productivity && npm run audit:admin-schema')) {
    errors.push('audit:all must include admin productivity and schema audits');
  }

  for (const [label, filePath] of [
    ['project-mode', PROJECT_MODE_PATH],
    ['project-mode-full', PROJECT_MODE_FULL_PATH]
  ]) {
    const text = read(filePath);
    if (!text.includes('scripts/audit_admin_local_productivity.js')) errors.push(`${label} is missing productivity audit`);
    if (!text.includes('scripts/audit_admin_dataset_schema.js')) errors.push(`${label} is missing schema audit`);
  }

  const workflow = read(WORKFLOW_PATH);
  for (const token of [
    'contents: read',
    'Generate admin surface inventory',
    'Audit admin surface',
    'Audit local admin productivity',
    'Audit nine admin data schemas',
    'Run full project mode audits'
  ]) {
    if (!workflow.includes(token)) errors.push(`profile workflow is missing ${token}`);
  }
  if (/contents:\s*write/i.test(workflow)) errors.push('profile workflow must remain read-only');

  if (errors.length) {
    throw new Error(`Admin local productivity audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Admin local productivity OK: ${expectedScripts.length} modules, ${matrix.length - 1} capabilities, direct publishing excluded`);
}

main();
