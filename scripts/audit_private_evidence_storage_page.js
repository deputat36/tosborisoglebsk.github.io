const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'PRIVATE-EVIDENCE-STORAGE-REQUIREMENTS.md');
const MODULE_PATH = path.join(ROOT, 'assets', 'js', 'private-evidence-storage.js');
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
    'id="private-evidence-storage"',
    'id="private-evidence-storage-stats"',
    'id="private-evidence-storage-list"',
    'Требования к закрытому хранилищу доказательств',
    'Подготовительный материал · решение №7',
    'все 30 слотов сравнения остаются <code>not_assessed</code>',
    'href="/data/private_evidence_storage_requirements.csv"',
    'href="/docs/PRIVATE-EVIDENCE-STORAGE-REQUIREMENTS.md"',
    '/assets/js/private-evidence-storage-validation.js',
    '/assets/js/private-evidence-storage.js'
  ]) requireToken(errors, page, token, 'personal-data-decisions/index.html');

  for (const link of ['/data/private_evidence_storage_requirements.csv', '/docs/PRIVATE-EVIDENCE-STORAGE-REQUIREMENTS.md']) {
    if (!repoPathExists(link)) errors.push(`linked target is missing: ${link}`);
  }

  const scenarioIndex = page.indexOf('/assets/js/personal-data-scenarios.js');
  const storageValidationIndex = page.indexOf('/assets/js/private-evidence-storage-validation.js');
  const storagePageIndex = page.indexOf('/assets/js/private-evidence-storage.js');
  if (!(scenarioIndex >= 0 && storageValidationIndex > scenarioIndex && storagePageIndex > storageValidationIndex)) {
    errors.push('storage scripts must load after scenario scripts in validation/page order');
  }

  for (const token of [
    'Матрица `data/private_evidence_storage_requirements.csv`',
    'Матрица содержит 10 критериев',
    'все значения должны оставаться `not_assessed`',
    '`selected_candidate_code`',
    'Решение `private_evidence_storage` должно оставаться `pending`',
    'Автоматический аудит подтверждает только целостность подготовительного пакета'
  ]) requireToken(errors, doc, token, 'PRIVATE-EVIDENCE-STORAGE-REQUIREMENTS.md');

  for (const token of [
    'data/private_evidence_storage_requirements.csv',
    'assets/js/private-evidence-storage-validation.js',
    'assets/js/private-evidence-storage.js',
    'scripts/test_private_evidence_storage_requirements.js',
    'scripts/audit_private_evidence_storage_requirements.js',
    'scripts/audit_private_evidence_storage_page.js',
    'Test private evidence storage requirements',
    'Audit private evidence storage requirements',
    'Audit private evidence storage page',
    'contents: read'
  ]) requireToken(errors, workflow, token, 'personal-data-decisions-audit.yml');
  if (/contents:\s*write/i.test(workflow)) errors.push('personal data decisions workflow must remain read-only');

  for (const script of [
    'scripts/test_private_evidence_storage_requirements.js',
    'scripts/audit_private_evidence_storage_requirements.js',
    'scripts/audit_private_evidence_storage_page.js'
  ]) requireToken(errors, manual, script, 'audit_manual_extensions.js');

  for (const token of [
    'test:private-evidence-storage',
    'audit:private-evidence-storage',
    'npm run test:private-evidence-storage',
    'npm run audit:private-evidence-storage'
  ]) requireToken(errors, packageText, token, 'package.json');

  for (const token of [
    "fetch('/data/private_evidence_storage_requirements.csv', { cache: 'no-store' })",
    "['a', 'b', 'c']",
    'candidate_${code}_result',
    'not_assessed'
  ]) requireToken(errors, moduleSource, token, 'private-evidence-storage.js');
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(moduleSource)) errors.push('storage page module must not specify a write method');
  if (/\b(?:localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(moduleSource)) errors.push('storage page module must remain read-only and storage-free');
  if (/\b(?:POST|PUT|PATCH|DELETE)\b/.test(moduleSource)) errors.push('storage page module must not contain HTTP write verbs');

  if (errors.length) throw new Error(`Private evidence storage page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Private evidence storage page OK: 10 criteria, 30 unassessed slots, read-only integration');
}

main();