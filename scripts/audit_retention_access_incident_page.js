const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'RETENTION-ACCESS-INCIDENT-RULES.md');
const MODULE_PATH = path.join(ROOT, 'assets', 'js', 'retention-access-incident.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'personal-data-decisions-audit.yml');
const MANUAL_PATH = path.join(ROOT, 'scripts', 'audit_manual_extensions.js');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireToken(errors, content, token, label) {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
}

function main() {
  const errors = [];
  const page = read(PAGE_PATH);
  const doc = read(DOC_PATH);
  const moduleSource = read(MODULE_PATH);
  const workflow = read(WORKFLOW_PATH);
  const manual = read(MANUAL_PATH);
  const packageText = read(PACKAGE_PATH);

  for (const token of [
    'id="retention-access-incident-rules"',
    'id="retention-access-incident-stats"',
    'id="retention-access-incident-list"',
    'Матрица хранения, доступа, удаления и инцидентов',
    'Подготовительный материал · решение №8',
    'все десять строк остаются <code>draft</code>',
    'реализация — <code>not_started</code>',
    'href="/data/retention_access_incident_rules.csv"',
    'href="/docs/RETENTION-ACCESS-INCIDENT-RULES.md"',
    '/assets/js/retention-access-incident-validation.js',
    '/assets/js/retention-access-incident.js'
  ]) requireToken(errors, page, token, 'personal-data-decisions/index.html');

  for (const link of ['/data/retention_access_incident_rules.csv', '/docs/RETENTION-ACCESS-INCIDENT-RULES.md']) {
    if (!repoPathExists(link)) errors.push(`linked target is missing: ${link}`);
  }

  const storagePageIndex = page.indexOf('/assets/js/private-evidence-storage.js');
  const rulesValidationIndex = page.indexOf('/assets/js/retention-access-incident-validation.js');
  const rulesPageIndex = page.indexOf('/assets/js/retention-access-incident.js');
  if (!(storagePageIndex >= 0 && rulesValidationIndex > storagePageIndex && rulesPageIndex > rulesValidationIndex)) {
    errors.push('rules scripts must load after storage scripts in validation/page order');
  }

  for (const token of [
    'Матрица `data/retention_access_incident_rules.csv`',
    '10 строк в фиксированном порядке',
    'шести тематическим группам',
    '`rule_status` должен оставаться `draft`',
    '`implementation_status` — `not_started`',
    'решения №8 в состоянии `pending / not_started`',
    'решения №7 как незавершённой зависимости'
  ]) requireToken(errors, doc, token, 'RETENTION-ACCESS-INCIDENT-RULES.md');

  for (const token of [
    'data/retention_access_incident_rules.csv',
    'assets/js/retention-access-incident-validation.js',
    'assets/js/retention-access-incident.js',
    'scripts/test_retention_access_incident_rules.js',
    'scripts/audit_retention_access_incident_rules.js',
    'scripts/audit_retention_access_incident_page.js',
    'Test retention access incident rules',
    'Audit retention access incident rules',
    'Audit retention access incident page',
    'contents: read'
  ]) requireToken(errors, workflow, token, 'personal-data-decisions-audit.yml');
  if (/contents:\s*write/i.test(workflow)) errors.push('personal data decisions workflow must remain read-only');

  for (const script of [
    'scripts/test_retention_access_incident_rules.js',
    'scripts/audit_retention_access_incident_rules.js',
    'scripts/audit_retention_access_incident_page.js'
  ]) requireToken(errors, manual, script, 'audit_manual_extensions.js');

  for (const token of [
    'test:retention-access-incident',
    'audit:retention-access-incident',
    'npm run test:retention-access-incident',
    'npm run audit:retention-access-incident'
  ]) requireToken(errors, packageText, token, 'package.json');

  for (const token of [
    "fetch('/data/retention_access_incident_rules.csv', { cache: 'no-store' })",
    'summary.undecided',
    'row.implementation_status'
  ]) requireToken(errors, moduleSource, token, 'retention-access-incident.js');
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(moduleSource)) errors.push('rules page module must not specify a write method');
  if (/\b(?:localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(moduleSource)) errors.push('rules page module must remain read-only and storage-free');
  if (/\b(?:POST|PUT|PATCH|DELETE)\b/.test(moduleSource)) errors.push('rules page module must not contain HTTP write verbs');

  if (errors.length) throw new Error(`Retention access incident page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Retention access incident page OK: 10 draft rules, read-only integration');
}

main();
