const fs = require('fs');
const path = require('path');
const pagesManualCheck = require('../assets/js/github-pages-manual-check');
const { buildPage, loadInputs, OUTPUT_PATH } = require('./generate_actions_check_page');

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'data', 'github_pages_manual_check_template.csv');
const MODULE_PATH = path.join(ROOT, 'assets', 'js', 'github-pages-manual-check.js');
const DOCS_PATH = path.join(ROOT, 'docs', 'GITHUB-PAGES-MANUAL-CHECK.md');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'actions-check-dynamic-audit.yml');
const MANUAL_EXTENSIONS_PATH = path.join(ROOT, 'scripts', 'audit_manual_extensions.js');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_actions_check_page.js');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireToken(errors, content, token, label) {
  if (!content.includes(token)) errors.push(`${label} is missing token: ${token}`);
}

function forbidToken(errors, content, token, label) {
  if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
}

function main() {
  const errors = [];
  const templateText = read(TEMPLATE_PATH);
  const rows = pagesManualCheck.parseCsv(templateText);
  const validation = pagesManualCheck.validateRows(rows);
  const page = read(OUTPUT_PATH);
  const expectedPage = buildPage(loadInputs());
  const moduleText = read(MODULE_PATH);
  const docs = read(DOCS_PATH);
  const workflow = read(WORKFLOW_PATH);
  const manualExtensions = read(MANUAL_EXTENSIONS_PATH);
  const generator = read(GENERATOR_PATH);

  if (rows.length !== 8) errors.push(`Pages wizard template must contain 8 rows, found ${rows.length}`);
  if (!validation.valid) errors.push(...validation.errors.map((error) => `template: ${error}`));
  rows.forEach((row, index) => {
    if (row.status !== 'not_checked') errors.push(`template line ${index + 2}: status must remain not_checked`);
    if (row.observed_value) errors.push(`template line ${index + 2}: observed_value must remain empty`);
    if (row.evidence_ref) errors.push(`template line ${index + 2}: evidence_ref must remain empty`);
  });

  if (page !== expectedPage) errors.push('actions-check page is stale after Pages wizard changes');
  for (const token of [
    'data-pages-manual-workspace',
    'id="pages-manual-form"',
    'id="pages-manual-items"',
    'id="pages-manual-actions-row"',
    'id="pages-manual-download-csv"',
    'id="pages-manual-download-diagnostic"',
    'id="pages-manual-copy-diagnostic"',
    'id="pages-manual-reset"',
    'Скачать заполненный CSV',
    'Скачать actions-013',
    'Черновик сохраняется только в localStorage этого браузера',
    'Статус <code>passed</code> появляется только после восьми положительно заполненных пунктов',
    '/assets/js/github-pages-manual-check.js'
  ]) requireToken(errors, page, token, 'actions-check page');

  const siteScriptIndex = page.indexOf('/assets/js/site.js');
  const wizardScriptIndex = page.indexOf('/assets/js/github-pages-manual-check.js');
  if (!(siteScriptIndex >= 0 && wizardScriptIndex > siteScriptIndex)) {
    errors.push('Pages wizard script must load after site.js');
  }

  for (const token of [
    'buildActionsDiagnosticRow',
    'serializeActionsDiagnosticRow',
    'serializeCsv',
    'mergeDraft',
    'localStorage',
    "const status = passed ? 'passed'",
    "summary.status === 'warning'",
    "status === 'not_checked'",
    'обнаружен признак токена, пароля или секрета',
    "fetch('/data/github_pages_manual_check_template.csv', { cache: 'no-store' })"
  ]) requireToken(errors, moduleText, token, 'Pages wizard module');
  for (const token of ['api.github.com', 'sendBeacon', 'XMLHttpRequest', 'method: \'POST\'', 'method: "POST"', 'contents: write', 'git push']) {
    forbidToken(errors, moduleText, token, 'Pages wizard module');
  }

  for (const token of [
    'Локальный мастер на странице `/actions-check/`',
    'localStorage',
    'Скачать заполненный CSV',
    'Скачать `actions-013`',
    '`passed` формируется только',
    'не отправляет данные в GitHub'
  ]) requireToken(errors, docs, token, 'Pages manual documentation');

  for (const token of [
    'data-pages-manual-workspace',
    'pages-manual-download-csv',
    '/assets/js/github-pages-manual-check.js',
    'Статус <code>passed</code> появляется только после восьми положительно заполненных пунктов'
  ]) requireToken(errors, generator, token, 'Actions page generator');

  for (const token of [
    "'assets/js/github-pages-manual-check.js'",
    "'scripts/test_github_pages_manual_check.js'",
    "'scripts/audit_github_pages_manual_check.js'",
    'node --check assets/js/github-pages-manual-check.js',
    'node scripts/test_github_pages_manual_check.js',
    'node scripts/audit_github_pages_manual_check.js',
    'contents: read'
  ]) requireToken(errors, workflow, token, 'Actions profile workflow');
  for (const token of ['contents: write', 'git push', 'git-auto-commit']) {
    forbidToken(errors, workflow, token, 'Actions profile workflow');
  }

  for (const token of [
    "['GitHub Pages manual check wizard self-test', 'scripts/test_github_pages_manual_check.js']",
    "['GitHub Pages manual check wizard', 'scripts/audit_github_pages_manual_check.js']"
  ]) requireToken(errors, manualExtensions, token, 'manual audit extensions');

  if (errors.length) {
    throw new Error(`GitHub Pages manual check wizard audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('GitHub Pages manual check wizard OK: 8 blank template rows, local-only draft, guarded exports');
}

if (require.main === module) main();
