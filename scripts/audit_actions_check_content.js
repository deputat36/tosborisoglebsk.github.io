const fs = require('fs');
const path = require('path');
const {
  buildPage,
  countStatuses,
  detectTriggers,
  diagnosticsRows,
  formatDate,
  latestIsoDate,
  loadInputs,
  OUTPUT_PATH
} = require('./generate_actions_check_page');

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const MAIN_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const PROFILE_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'actions-check-dynamic-audit.yml');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractNumber(html, attribute) {
  const match = html.match(new RegExp(`<[^>]+${attribute}[^>]*>(\\d+)<\\/[^>]+>`));
  return match ? Number(match[1]) : NaN;
}

function main() {
  const errors = [];
  const inputs = loadInputs();
  const html = read(OUTPUT_PATH);
  const expected = buildPage(inputs);
  const rows = diagnosticsRows(inputs.diagnostics);
  const statuses = countStatuses(rows);
  const triggers = detectTriggers(inputs.workflow);
  const latestCheckedAt = latestIsoDate(rows);
  const pages = inputs.health.pages || {};

  if (html !== expected) {
    errors.push('actions-check/index.html is stale; regenerate it with scripts/generate_actions_check_page.js');
  }

  const requiredMarkers = [
    '<meta name="robots" content="noindex,nofollow"/>',
    'Generated from data/site_health.json and data/actions_diagnostics.csv',
    'data-actions-current-snapshot',
    `data-actions-health-generated-at="${inputs.health.generated_at}"`,
    'Текущий снимок производных данных',
    'Исторический журнал',
    'Страница намеренно не выводит commit SHA',
    `<b data-actions-diagnostics-latest>${formatDate(latestCheckedAt)}</b>`,
    '/data/actions_diagnostics.csv',
    '/data/site_health.json',
    '/github-tasks/'
  ];
  for (const marker of requiredMarkers) {
    if (!html.includes(marker)) errors.push(`actions-check/index.html is missing marker: ${marker}`);
  }

  const numericContracts = [
    ['data-actions-pages-total', pages.total],
    ['data-actions-pages-public', pages.public],
    ['data-actions-pages-noindex', pages.noindex],
    ['data-actions-seo-warnings', pages.seo_warnings_count],
    ['data-actions-broken-links', pages.broken_internal_links_count],
    ['data-actions-diagnostics-total', rows.length],
    ['data-actions-status-passed', statuses.passed || 0],
    ['data-actions-status-warning', statuses.warning || 0],
    ['data-actions-status-pending', statuses.pending || 0],
    ['data-actions-status-failed', statuses.failed || 0],
    ['data-actions-status-blocked', statuses.blocked || 0]
  ];
  for (const [attribute, expectedValue] of numericContracts) {
    const actualValue = extractNumber(html, attribute);
    if (actualValue !== expectedValue) errors.push(`${attribute}: expected ${expectedValue}, found ${actualValue}`);
  }

  for (const trigger of triggers) {
    if (!html.includes(trigger.label)) errors.push(`actions-check page is missing workflow trigger label: ${trigger.label}`);
  }
  if (!triggers.some((item) => item.key === 'schedule') && /Фактически обнаруженные триггеры:[^<]*расписание/i.test(html)) {
    errors.push('actions-check page must not claim a schedule trigger when YAML has no schedule key');
  }

  const historicalEvidence = rows.map((row) => row.evidence || '').join('\n');
  const historicalShas = historicalEvidence.match(/\b[a-f0-9]{40}\b/gi) || [];
  for (const sha of historicalShas) {
    if (html.includes(sha)) errors.push(`historical commit SHA must not be rendered as current status: ${sha}`);
  }

  const forbiddenStaticPhrases = [
    'Итог проверки на 2 июля 2026 года',
    '369 HTML-страниц, 332 публичные, 37',
    '371 HTML-страница, 331 публичная, 40',
    'commit c6aed65301c907a45520379ef9574f601cd7707c'
  ];
  for (const phrase of forbiddenStaticPhrases) {
    if (html.includes(phrase)) errors.push(`stale static Actions phrase is forbidden: ${phrase}`);
  }

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  if (scripts['generate:actions-check'] !== 'node scripts/generate_actions_check_page.js') {
    errors.push('package.json must define generate:actions-check');
  }
  if (scripts['test:actions-check'] !== 'node scripts/test_actions_check_dynamic_contract.js') {
    errors.push('package.json must define test:actions-check');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run test:actions-check')) {
    errors.push('audit:all must include test:actions-check');
  }

  for (const [label, filePath] of [
    ['project-mode', PROJECT_MODE_PATH],
    ['project-mode-full', PROJECT_MODE_FULL_PATH]
  ]) {
    if (!read(filePath).includes('scripts/test_actions_check_dynamic_contract.js')) {
      errors.push(`${label} must include Actions dynamic contract self-test`);
    }
  }

  const mainWorkflow = read(MAIN_WORKFLOW_PATH);
  if (!mainWorkflow.includes('Generate dynamic Actions check page')) {
    errors.push('main workflow must generate the Actions check page');
  }
  const profileWorkflow = read(PROFILE_WORKFLOW_PATH);
  for (const token of ['contents: read', 'Generate Actions check page', 'Audit dynamic Actions check page', 'Run full project mode audits']) {
    if (!profileWorkflow.includes(token)) errors.push(`Actions profile workflow is missing ${token}`);
  }
  if (/contents:\s*write/i.test(profileWorkflow)) errors.push('Actions profile workflow must remain read-only');

  if (errors.length) {
    throw new Error(`Actions check content audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Actions check content OK: ${pages.total} pages, ${rows.length} historical diagnostics, ${triggers.length} workflow triggers`);
}

main();
