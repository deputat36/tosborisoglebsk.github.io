const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'actions-check', 'index.html');
const CSV_PATH = path.join(ROOT, 'data', 'actions_diagnostics.csv');
const DOMAIN_PATH = path.join(ROOT, 'data', 'domain_access_check.csv');
const HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'ACTIONS-DIAGNOSTICS-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

const expectedHeaders = [
  'check_id',
  'group',
  'subject',
  'result',
  'evidence',
  'status',
  'next_action',
  'checked_at'
];
const expectedIds = Array.from({ length: 10 }, (_, index) => `actions-${String(index + 1).padStart(3, '0')}`);
const allowedStatuses = new Set(['passed', 'warning', 'pending']);
const expectedRuns = new Map([
  ['actions-004', { pr: '#241', runId: '29306238698', runNumber: '1293' }],
  ['actions-005', { pr: '#242', runId: '29306614320', runNumber: '1295' }],
  ['actions-006', { pr: '#243', runId: '29307180271', runNumber: '1298' }]
]);
const errors = [];

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function read(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

function parseDate(value) {
  const match = normalize(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
}

const html = read(HTML_PATH, 'Actions check page');
const csvText = read(CSV_PATH, 'Actions diagnostics CSV');
const domainText = read(DOMAIN_PATH, 'domain access history');
const healthText = read(HEALTH_PATH, 'site health JSON');
const workflow = read(WORKFLOW_PATH, 'generation workflow');
const documentation = read(DOC_PATH, 'Actions diagnostics documentation');
const packageText = read(PACKAGE_PATH, 'package.json');
const projectMode = read(PROJECT_MODE_PATH, 'project-mode audit');
const projectModeFull = read(PROJECT_MODE_FULL_PATH, 'full project-mode audit');

let health = null;
try {
  health = JSON.parse(healthText);
} catch (error) {
  errors.push(`site health JSON is invalid: ${error.message}`);
}

const rows = parseCsv(csvText);
const headers = (rows[0] || []).map(normalize);
if (headers.join('|') !== expectedHeaders.join('|')) {
  errors.push(`unexpected actions diagnostics headers: ${headers.join(', ')}`);
}
const records = rows.slice(1).filter((row) => row.some((value) => normalize(value)));
if (records.length !== expectedIds.length) {
  errors.push(`actions diagnostics must contain ${expectedIds.length} records, found ${records.length}`);
}

const byId = new Map();
records.forEach((row, index) => {
  const context = `actions diagnostics row ${index + 2}`;
  const values = expectedHeaders.map((_, column) => normalize(row[column]));
  const [id, group, subject, result, evidence, status, nextAction, checkedAt] = values;

  if (!/^actions-\d{3}$/.test(id)) errors.push(`${context}: invalid check_id ${id}`);
  if (byId.has(id)) errors.push(`${context}: duplicate check_id ${id}`);
  byId.set(id, { id, group, subject, result, evidence, status, nextAction, checkedAt });

  if (!group || !subject || !result || !evidence || !nextAction) errors.push(`${context}: required field is empty`);
  if (!allowedStatuses.has(status)) errors.push(`${context}: unsupported status ${status}`);
  if (!Number.isFinite(parseDate(checkedAt))) errors.push(`${context}: invalid checked_at ${checkedAt}`);
});

expectedIds.forEach((id) => {
  if (!byId.has(id)) errors.push(`missing required Actions diagnostic ${id}`);
});

expectedRuns.forEach((expected, id) => {
  const record = byId.get(id);
  if (!record) return;
  if (record.status !== 'passed') errors.push(`${id}: confirmed PR run must be passed`);
  requireTokens(`${record.subject} ${record.result} ${record.evidence}`, [
    expected.pr,
    expected.runId,
    expected.runNumber,
    'success'
  ], id);
  requireTokens(html, [expected.pr.replace('#', 'PR №'), expected.runId], 'Actions check page');
  requireTokens(documentation, [expected.pr, expected.runId, expected.runNumber, 'success'], 'Actions diagnostics documentation');
});

const productionRecord = byId.get('actions-008');
const pagesRecord = byId.get('actions-009');
const domainRecord = byId.get('actions-010');
if (productionRecord?.status !== 'pending') errors.push('actions-008 production CI must remain pending before merge');
if (pagesRecord?.status !== 'pending') errors.push('actions-009 Pages deployment must remain pending before merge');
if (domainRecord?.status !== 'warning') errors.push('actions-010 historical domain check must remain warning');

requireTokens(workflow, [
  'workflow_dispatch:',
  'pull_request:',
  'push:',
  'branches:',
  '- release-2025-12-22'
], 'generation workflow');
if (/^\s*schedule\s*:/m.test(workflow)) {
  errors.push('main generation workflow must not be documented as unscheduled while schedule trigger exists');
}

if (health) {
  const pageStats = health.pages || {};
  const healthTokens = [
    normalize(health.generated_at),
    `${pageStats.total} HTML`,
    `${pageStats.public} публич`,
    `${pageStats.noindex} <code>noindex</code>`,
    `${pageStats.seo_warnings_count} SEO-предупреждений`,
    `${pageStats.broken_internal_links_count} битых внутренних ссылок`
  ];
  requireTokens(html, healthTokens, 'Actions check page health snapshot');

  const healthRecord = byId.get('actions-007');
  if (!healthRecord || healthRecord.status !== 'passed') {
    errors.push('actions-007 technical baseline must be passed');
  } else {
    requireTokens(`${healthRecord.result} ${healthRecord.evidence}`, [
      normalize(health.generated_at),
      String(pageStats.total),
      String(pageStats.public),
      String(pageStats.noindex),
      String(pageStats.seo_warnings_count),
      String(pageStats.broken_internal_links_count),
      'data/site_health.json'
    ], 'actions-007');
  }
}

const domainRows = parseCsv(domainText).slice(1).filter((row) => row.some((value) => normalize(value)));
const domainDates = domainRows.map((row) => parseDate(row[0])).filter(Number.isFinite);
if (!domainDates.length) {
  errors.push('domain access history must contain dated records');
} else {
  const latestDomainDate = new Date(Math.max(...domainDates)).toISOString().slice(0, 10);
  if (latestDomainDate !== '2026-06-23') {
    errors.push(`expected historical domain snapshot 2026-06-23, found ${latestDomainDate}`);
  }
  requireTokens(html, [latestDomainDate, 'не считается текущей проверкой'], 'Actions check page domain disclaimer');
}

requireTokens(html, [
  'noindex,follow',
  'Снимок на 14 июля 2026 года',
  'не автоматически обновляемый live-status',
  'PR-CI подтверждён реальными run',
  'Триггер <code>schedule</code> в этом workflow отсутствует',
  'Что ещё не подтверждено',
  'PR-runs не доказывают',
  '/data/actions_diagnostics.csv',
  '/data/domain_access_check.csv'
], 'Actions check page');

[
  'Commit workflow endpoint вернул пустой список',
  'workflow_runs</code>. Это не доказывает',
  'GitHub Actions UI нужно проверить вручную',
  'публикация GitHub Pages подтверждена',
  'Он запускается вручную, по расписанию'
].forEach((token) => {
  if (html.includes(token)) errors.push(`Actions check page contains obsolete claim: ${token}`);
});

requireTokens(documentation, [
  'не является live-status',
  'PR-CI для merge-ref pull request',
  'push-run ветки `release-2025-12-22`',
  'фактический GitHub Pages deployment',
  'Триггер `schedule` в основном workflow отсутствует',
  'не считается текущей проверкой',
  'Строка получает `passed` только при наличии конкретного evidence'
], 'Actions diagnostics documentation');

let packageJson = null;
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  errors.push(`package.json is invalid JSON: ${error.message}`);
}
if (packageJson) {
  const scripts = packageJson.scripts || {};
  if (scripts['audit:actions-diagnostics'] !== 'node scripts/audit_actions_check_content.js') {
    errors.push('package.json must define audit:actions-diagnostics');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run audit:actions-diagnostics')) {
    errors.push('audit:all must include audit:actions-diagnostics');
  }
}

requireTokens(projectMode, [
  "['Actions diagnostics', 'scripts/audit_actions_check_content.js']"
], 'project-mode audit');
requireTokens(projectModeFull, [
  "['Actions diagnostics audit', 'scripts/audit_actions_check_content.js']"
], 'full project-mode audit');

if (errors.length) {
  throw new Error(`Actions diagnostics audit failed:\n${errors.join('\n')}`);
}

console.log(`Actions diagnostics OK: ${records.length} records, ${expectedRuns.size} confirmed PR runs, production and Pages kept pending`);
