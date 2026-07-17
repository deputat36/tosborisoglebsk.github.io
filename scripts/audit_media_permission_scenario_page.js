const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'MEDIA-PERMISSION-SCENARIOS.md');
const MODULE_PATH = path.join(ROOT, 'assets', 'js', 'media-permission-scenarios.js');
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
    'id="media-permission-scenarios"',
    'id="media-permission-scenario-stats"',
    'id="media-permission-scenario-list"',
    'Подготовительный материал · решение №5',
    'Черновые сценарии публикации фотографий, логотипов и других медиа',
    'все десять строк остаются <code>draft</code>',
    'не является формой согласия или разрешения',
    'href="/data/media_permission_scenarios.csv"',
    'href="/docs/MEDIA-PERMISSION-SCENARIOS.md"',
    '/assets/js/media-permission-scenario-validation.js',
    '/assets/js/media-permission-scenarios.js'
  ]) requireToken(errors, page, token, 'personal-data-decisions/index.html');

  for (const link of ['/data/media_permission_scenarios.csv', '/docs/MEDIA-PERMISSION-SCENARIOS.md']) {
    if (!repoPathExists(link)) errors.push(`linked target is missing: ${link}`);
  }

  const scenarioPageIndex = page.indexOf('/assets/js/personal-data-scenarios.js');
  const mediaValidationIndex = page.indexOf('/assets/js/media-permission-scenario-validation.js');
  const mediaPageIndex = page.indexOf('/assets/js/media-permission-scenarios.js');
  const withdrawalValidationIndex = page.indexOf('/assets/js/withdrawal-correction-deletion-validation.js');
  if (!(scenarioPageIndex >= 0 && mediaValidationIndex > scenarioPageIndex && mediaPageIndex > mediaValidationIndex && withdrawalValidationIndex > mediaPageIndex)) {
    errors.push('media scripts must load after scenario scripts and before withdrawal scripts');
  }

  for (const token of [
    'Матрица `data/media_permission_scenarios.csv`',
    '10 сценариев',
    'шести группам',
    '`scenario_status` должен оставаться `draft`',
    'Решение №5 зависит от решений',
    'pending / not_started',
    'не заменяет юридически проверенное разрешение'
  ]) requireToken(errors, doc, token, 'MEDIA-PERMISSION-SCENARIOS.md');

  for (const token of [
    'data/media_permission_scenarios.csv',
    'assets/js/media-permission-scenario-validation.js',
    'assets/js/media-permission-scenarios.js',
    'scripts/test_media_permission_scenarios.js',
    'scripts/audit_media_permission_scenarios.js',
    'scripts/audit_media_permission_scenario_page.js',
    'Test media permission scenarios',
    'Audit media permission scenarios',
    'Audit media permission scenario page',
    'contents: read'
  ]) requireToken(errors, workflow, token, 'personal-data-decisions-audit.yml');
  if (/contents:\s*write/i.test(workflow)) errors.push('personal data decisions workflow must remain read-only');

  for (const script of [
    'scripts/test_media_permission_scenarios.js',
    'scripts/audit_media_permission_scenarios.js',
    'scripts/audit_media_permission_scenario_page.js'
  ]) requireToken(errors, manual, script, 'audit_manual_extensions.js');

  for (const token of [
    'test:media-permission-scenarios',
    'audit:media-permission-scenarios',
    'npm run test:media-permission-scenarios',
    'npm run audit:media-permission-scenarios'
  ]) requireToken(errors, packageText, token, 'package.json');

  for (const token of [
    "fetch('/data/media_permission_scenarios.csv', { cache: 'no-store' })",
    'selected_permission_scope_code',
    'не выбрано'
  ]) requireToken(errors, moduleSource, token, 'media-permission-scenarios.js');
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(moduleSource)) errors.push('media page module must not specify a write method');
  if (/\b(?:localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(moduleSource)) errors.push('media page module must remain read-only and storage-free');
  if (/\b(?:POST|PUT|PATCH|DELETE)\b/.test(moduleSource)) errors.push('media page module must not contain HTTP write verbs');

  if (errors.length) throw new Error(`Media permission page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Media permission page OK: 10 draft scenarios, read-only integration');
}

main();
