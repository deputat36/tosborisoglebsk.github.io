const fs = require('fs');
const path = require('path');
const pagesManualCheck = require('../assets/js/github-pages-manual-check');
const { buildPage, loadInputs, OUTPUT_PATH } = require('./generate_actions_check_page');

const ROOT = process.cwd();
const PATHS = {
  template: path.join(ROOT, 'data', 'github_pages_manual_check_template.csv'),
  logic: path.join(ROOT, 'assets', 'js', 'github-pages-manual-check.js'),
  workspace: path.join(ROOT, 'assets', 'js', 'github-pages-manual-check-workspace.js'),
  docs: path.join(ROOT, 'docs', 'GITHUB-PAGES-MANUAL-CHECK.md'),
  workflow: path.join(ROOT, '.github', 'workflows', 'actions-check-dynamic-audit.yml'),
  manual: path.join(ROOT, 'scripts', 'audit_manual_extensions.js'),
  generator: path.join(ROOT, 'scripts', 'generate_actions_check_page.js')
};

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(errors, content, tokens, label) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing token: ${token}`);
  }
}

function main() {
  const errors = [];
  const rows = pagesManualCheck.parseCsv(read(PATHS.template));
  const validation = pagesManualCheck.validateRows(rows);
  const page = read(OUTPUT_PATH);
  const expectedPage = buildPage(loadInputs());
  const logic = read(PATHS.logic);
  const workspace = read(PATHS.workspace);
  const docs = read(PATHS.docs);
  const workflow = read(PATHS.workflow);
  const manual = read(PATHS.manual);
  const generator = read(PATHS.generator);

  if (rows.length !== 8) errors.push(`Pages wizard template must contain 8 rows, found ${rows.length}`);
  if (!validation.valid) errors.push(...validation.errors.map((error) => `template: ${error}`));
  rows.forEach((row, index) => {
    if (row.status !== 'not_checked') errors.push(`template line ${index + 2}: status must remain not_checked`);
    if (row.observed_value) errors.push(`template line ${index + 2}: observed_value must remain empty`);
    if (row.evidence_ref) errors.push(`template line ${index + 2}: evidence_ref must remain empty`);
  });

  if (page !== expectedPage) errors.push('actions-check page is stale after Pages wizard changes');
  requireTokens(errors, page, [
    'data-pages-manual-check',
    'actions-013',
    'not_checked',
    'не закрывает issue #164',
    '/assets/js/github-pages-manual-check.js',
    '/assets/js/github-pages-manual-check-workspace.js'
  ], 'actions-check page');

  const siteIndex = page.indexOf('/assets/js/site.js');
  const logicIndex = page.indexOf('/assets/js/github-pages-manual-check.js');
  const workspaceIndex = page.indexOf('/assets/js/github-pages-manual-check-workspace.js');
  if (!(siteIndex >= 0 && logicIndex > siteIndex && workspaceIndex > logicIndex)) {
    errors.push('Pages scripts must load in order: site, logic, workspace');
  }

  requireTokens(errors, logic, [
    'buildActionsDiagnosticRow',
    'serializeActionsDiagnosticRow',
    'serializeCsv',
    'mergeDraft',
    'localStorage',
    "const status = passed ? 'passed'",
    "summary.status === 'warning'",
    "status === 'not_checked'",
    "fetch('/data/github_pages_manual_check_template.csv', { cache: 'no-store' })"
  ], 'Pages wizard logic');

  requireTokens(errors, workspace, [
    "document.querySelector('[data-pages-manual-check]')",
    'root.dataset.pagesManualWorkspace',
    'pages-manual-form',
    'pages-manual-items',
    'pages-manual-actions-row',
    'pages-manual-download-csv',
    'pages-manual-download-diagnostic',
    'pages-manual-copy-diagnostic',
    'pages-manual-reset',
    'Скачать заполненный CSV',
    'Скачать actions-013',
    'localStorage этого браузера',
    'GitHubPagesManualCheck.mount(document)'
  ], 'Pages wizard workspace');

  requireTokens(errors, docs, [
    'Локальный мастер на странице `/actions-check/`',
    'localStorage',
    'Скачать заполненный CSV',
    'Скачать `actions-013`',
    '`passed` формируется только',
    'не отправляет данные в GitHub'
  ], 'Pages manual documentation');

  requireTokens(errors, generator, [
    'data-pages-manual-check',
    '/assets/js/github-pages-manual-check.js',
    '/assets/js/github-pages-manual-check-workspace.js'
  ], 'Actions page generator');
  if (generator.includes('data-pages-manual-workspace')) errors.push('generator must keep workspace markup outside static HTML');

  requireTokens(errors, workflow, [
    "'assets/js/github-pages-manual-check.js'",
    "'assets/js/github-pages-manual-check-workspace.js'",
    "'scripts/test_github_pages_manual_check.js'",
    "'scripts/audit_github_pages_manual_check.js'",
    'node --check assets/js/github-pages-manual-check.js',
    'node --check assets/js/github-pages-manual-check-workspace.js',
    'node scripts/test_github_pages_manual_check.js',
    'node scripts/audit_github_pages_manual_check.js',
    'contents: read'
  ], 'Actions profile workflow');

  requireTokens(errors, manual, [
    "['GitHub Pages manual check wizard self-test', 'scripts/test_github_pages_manual_check.js']",
    "['GitHub Pages manual check wizard', 'scripts/audit_github_pages_manual_check.js']"
  ], 'manual audit extensions');

  if (errors.length) throw new Error(`GitHub Pages manual check wizard audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('GitHub Pages manual check wizard OK: 8 blank rows, local draft, guarded exports');
}

if (require.main === module) main();
