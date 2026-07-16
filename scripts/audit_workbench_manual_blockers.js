const fs = require('fs');
const path = require('path');
const summaryApi = require('../assets/js/manual-blocker-summary');
const outreachValidation = require('../assets/js/outreach-validation');
const publicationBasisValidation = require('../assets/js/publication-basis-validation');
const personalDataDecisionValidation = require('../assets/js/personal-data-decision-validation');

const ROOT = process.cwd();
const PATHS = {
  page: 'workbench/index.html',
  loader: 'assets/js/workbench-drafts.js',
  module: 'assets/js/workbench-manual-blockers.js',
  docs: 'docs/WORKBENCH-MANUAL-BLOCKERS.md',
  workflow: '.github/workflows/manual-tasks-governance.yml',
  manualAudit: 'scripts/audit_manual_extensions.js',
  verification: 'data/verification_readiness_matrix.csv',
  pages: 'data/github_pages_manual_check_template.csv',
  outreach: 'data/outreach_register.csv',
  personalData: 'data/personal_data_decision_packet.csv',
  publication: 'data/publication_basis_confirmation_register.csv'
};

const EXPECTED_ISSUES = ['34', '164', '166', '205', '254'];
const EXPECTED_TOTALS = { '34': 4, '164': 8, '166': 15, '205': 8, '254': 24 };

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(errors, content, label, tokens) {
  tokens.forEach((token) => {
    if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
  });
}

function main() {
  const errors = [];
  const page = read(PATHS.page);
  const loader = read(PATHS.loader);
  const moduleSource = read(PATHS.module);
  const docs = read(PATHS.docs);
  const workflow = read(PATHS.workflow);
  const manualAudit = read(PATHS.manualAudit);

  requireTokens(errors, page, PATHS.page, [
    '<meta name="robots" content="noindex,nofollow"/>',
    '<main id="main">',
    '/assets/js/workbench.js',
    '/assets/js/workbench-drafts.js'
  ]);

  requireTokens(errors, loader, PATHS.loader, [
    '/assets/js/workbench-manual-blockers.js',
    'data-workbench-manual-loader',
    'document.head.appendChild(script)'
  ]);

  requireTokens(errors, moduleSource, PATHS.module, [
    'id="workbench-manual-blockers"',
    'id="workbench-manual-blocker-stats"',
    'Ручные блокеры и внешние действия',
    'эта сводка только читает канонические CSV',
    '/github-tasks/',
    '/docs/WORKBENCH-MANUAL-BLOCKERS.md',
    '/verification-readiness/',
    '/actions-check/',
    '/outreach-register/#outreach-execution-root',
    '/personal-data-decisions/',
    '/publication-basis-review/#publication-basis-execution-root',
    '/data/verification_readiness_matrix.csv',
    '/data/github_pages_manual_check_template.csv',
    '/data/outreach_register.csv',
    '/data/personal_data_decision_packet.csv',
    '/data/publication_basis_confirmation_register.csv',
    '/assets/js/outreach-validation.js',
    '/assets/js/publication-basis-validation.js',
    '/assets/js/personal-data-decision-validation.js',
    '/assets/js/manual-blocker-summary.js',
    'Promise.allSettled',
    'dataset.workbenchManualReady'
  ]);

  const issueOrder = Array.from(moduleSource.matchAll(/data-workbench-manual-issue="(\d+)"/g), (match) => match[1]);
  if (issueOrder.join(',') !== EXPECTED_ISSUES.join(',')) {
    errors.push(`workbench manual issue order must be ${EXPECTED_ISSUES.join(',')}, found ${issueOrder.join(',')}`);
  }
  if (new Set(issueOrder).size !== issueOrder.length) errors.push('workbench manual issue cards must not contain duplicates');
  if (moduleSource.includes('data-workbench-manual-issue="165"')) errors.push('closed issue 165 must not appear in workbench');

  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(moduleSource)) errors.push('workbench blocker module must not specify a write method');
  if (/\b(?:XMLHttpRequest|sendBeacon|WebSocket)\b/.test(moduleSource)) errors.push('workbench blocker module must remain fetch-read-only');
  if (/\b(?:POST|PUT|PATCH|DELETE)\b/.test(moduleSource)) errors.push('workbench blocker module must not contain HTTP write verbs');

  const summaries = [
    summaryApi.summarizeVerification(summaryApi.parseCsv(read(PATHS.verification))),
    summaryApi.summarizePages(summaryApi.parseCsv(read(PATHS.pages))),
    summaryApi.summarizeOutreach(summaryApi.parseCsv(read(PATHS.outreach)), outreachValidation),
    summaryApi.summarizePersonalData(summaryApi.parseCsv(read(PATHS.personalData)), personalDataDecisionValidation),
    summaryApi.summarizePublicationBasis(summaryApi.parseCsv(read(PATHS.publication)), publicationBasisValidation)
  ];

  summaries.forEach((summary) => {
    if (summary.total !== EXPECTED_TOTALS[summary.issue]) {
      errors.push(`issue ${summary.issue}: expected ${EXPECTED_TOTALS[summary.issue]} rows, found ${summary.total}`);
    }
    if (Number(summary.invalid || summary.failed || 0) > 0) {
      errors.push(`issue ${summary.issue}: canonical source has structural errors`);
    }
    if (!/^\d+\/\d+$/.test(summary.progress || '')) errors.push(`issue ${summary.issue}: invalid progress label`);
  });

  requireTokens(errors, docs, PATHS.docs, [
    'Рабочая панель `/workbench/` показывает компактную сводку пяти открытых задач',
    'Никакие данные из блока не отправляются обратно на сервер или в GitHub',
    'Блок не может:',
    'Автоматический аудит подтверждает только целостность инструмента'
  ]);

  requireTokens(errors, workflow, PATHS.workflow, [
    'assets/js/workbench-manual-blockers.js',
    'assets/js/workbench-drafts.js',
    'scripts/audit_workbench_manual_blockers.js',
    'Audit workbench manual blockers',
    'contents: read'
  ]);
  if (/contents:\s*write/i.test(workflow)) errors.push('manual tasks workflow must remain read-only');

  if (!manualAudit.includes('scripts/audit_workbench_manual_blockers.js')) {
    errors.push('audit_manual_extensions.js must include workbench manual blockers audit');
  }

  if (errors.length) {
    throw new Error(`Workbench manual blockers audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Workbench manual blockers OK: 5 issues, 59 canonical rows, read-only workbench entry point');
}

main();
