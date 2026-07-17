const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'WITHDRAWAL-CORRECTION-DELETION-PROCESS.md');
const MODULE_PATH = path.join(ROOT, 'assets', 'js', 'withdrawal-correction-deletion.js');
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
    'id="withdrawal-correction-deletion"',
    'id="withdrawal-correction-deletion-stats"',
    'id="withdrawal-correction-deletion-list"',
    'Черновой маршрут исправления, отзыва и удаления публикаций',
    'Подготовительный материал · решение №6',
    'все восемь этапов остаются <code>draft</code>',
    'href="/data/withdrawal_correction_deletion_process.csv"',
    'href="/docs/WITHDRAWAL-CORRECTION-DELETION-PROCESS.md"',
    '/assets/js/withdrawal-correction-deletion-validation.js',
    '/assets/js/withdrawal-correction-deletion.js'
  ]) requireToken(errors, page, token, 'personal-data-decisions/index.html');

  for (const link of ['/data/withdrawal_correction_deletion_process.csv', '/docs/WITHDRAWAL-CORRECTION-DELETION-PROCESS.md']) {
    if (!repoPathExists(link)) errors.push(`linked target is missing: ${link}`);
  }

  const scenarioIndex = page.indexOf('/assets/js/personal-data-scenarios.js');
  const processValidationIndex = page.indexOf('/assets/js/withdrawal-correction-deletion-validation.js');
  const processPageIndex = page.indexOf('/assets/js/withdrawal-correction-deletion.js');
  const storageValidationIndex = page.indexOf('/assets/js/private-evidence-storage-validation.js');
  if (!(scenarioIndex >= 0 && processValidationIndex > scenarioIndex && processPageIndex > processValidationIndex && storageValidationIndex > processPageIndex)) {
    errors.push('process scripts must load after scenario scripts and before storage scripts');
  }

  for (const token of [
    'Восемь этапов',
    '`owner_role_code`',
    '`channel_code`',
    '`target_time_code`',
    '`evidence_ref`',
    'решения №6 `withdrawal_correction_and_deletion_process`',
    'Наличие строки в CSV не означает',
    'Автоматическая проверка не заменяет организационное решение'
  ]) requireToken(errors, doc, token, 'WITHDRAWAL-CORRECTION-DELETION-PROCESS.md');

  for (const token of [
    'data/withdrawal_correction_deletion_process.csv',
    'assets/js/withdrawal-correction-deletion-validation.js',
    'assets/js/withdrawal-correction-deletion.js',
    'scripts/test_withdrawal_correction_deletion_process.js',
    'scripts/audit_withdrawal_correction_deletion_process.js',
    'scripts/audit_withdrawal_correction_deletion_page.js',
    'Test withdrawal correction deletion process',
    'Audit withdrawal correction deletion process',
    'Audit withdrawal correction deletion page',
    'contents: read'
  ]) requireToken(errors, workflow, token, 'personal-data-decisions-audit.yml');
  if (/contents:\s*write/i.test(workflow)) errors.push('personal data decisions workflow must remain read-only');

  for (const script of [
    'scripts/test_withdrawal_correction_deletion_process.js',
    'scripts/audit_withdrawal_correction_deletion_process.js',
    'scripts/audit_withdrawal_correction_deletion_page.js'
  ]) requireToken(errors, manual, script, 'audit_manual_extensions.js');

  for (const token of [
    'test:withdrawal-correction-deletion',
    'audit:withdrawal-correction-deletion',
    'npm run test:withdrawal-correction-deletion',
    'npm run audit:withdrawal-correction-deletion'
  ]) requireToken(errors, packageText, token, 'package.json');

  for (const token of [
    "fetch('/data/withdrawal_correction_deletion_process.csv', { cache: 'no-store' })",
    '#withdrawal-correction-deletion-stats',
    '#withdrawal-correction-deletion-list',
    'Черновик процесса'
  ]) requireToken(errors, moduleSource, token, 'withdrawal-correction-deletion.js');
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(moduleSource)) errors.push('process page module must not specify a write method');
  if (/\b(?:localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(moduleSource)) errors.push('process page module must remain read-only and storage-free');
  if (/\b(?:POST|PUT|PATCH|DELETE)\b/.test(moduleSource)) errors.push('process page module must not contain HTTP write verbs');

  if (errors.length) throw new Error(`Withdrawal correction deletion page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Withdrawal correction deletion page OK: 8 draft stages, read-only integration');
}

main();
