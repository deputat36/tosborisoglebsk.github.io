const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');
const { manualTaskStatuses, manualTaskGroups } = require('./lib/status_sets');

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, 'data', 'github_manual_tasks.csv');
const PAGE_PATH = path.join(ROOT, 'github-tasks', 'index.html');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'manual-tasks-governance.yml');
const DOCS_PATH = path.join(ROOT, 'docs', 'GITHUB-MANUAL-TASKS-GOVERNANCE.md');

const expectedHeaders = [
  'issue_number',
  'title',
  'group',
  'status',
  'site_tool',
  'source_file',
  'success_criteria',
  'next_action',
  'created_or_updated'
];

const expectedTasks = {
  '0': {
    title: 'Очередь решений пользователя',
    group: 'project-control',
    status: 'open',
    siteTool: '/github-tasks/',
    sourceFile: 'data/user_decision_queue.csv'
  },
  '34': {
    title: 'Получить подтверждение сведений по 4 карточкам высокого приоритета',
    group: 'data-verification',
    status: 'open',
    siteTool: '/verification-readiness/',
    sourceFile: 'data/verification_readiness_matrix.csv'
  },
  '164': {
    title: 'Проверить GitHub Pages deployment вручную',
    group: 'technical-ops',
    status: 'open',
    siteTool: '/actions-check/',
    sourceFile: 'data/actions_diagnostics.csv'
  },
  '166': {
    title: 'Отправить 15 подготовленных запросов из outreach-register',
    group: 'outreach',
    status: 'open',
    siteTool: '/outreach-register/',
    sourceFile: 'data/outreach_register.csv'
  },
  '205': {
    title: 'ТОС БГО 2.0: закрыть юридические и фактологические риски P0',
    group: 'legal-readiness',
    status: 'open',
    siteTool: '/site-health/',
    sourceFile: 'data/personal_data_readiness.json'
  },
  '254': {
    title: 'Получить фактические подтверждения по 24 карточкам ТОС',
    group: 'publication-basis',
    status: 'open',
    siteTool: '/reply-review/',
    sourceFile: 'data/publication_basis_review_queue.csv'
  }
};

const expectedPageIssueIds = ['34', '164', '166', '205', '254'];

function readRequired(filePath, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireToken(content, token, label, errors) {
  if (!content.includes(token)) errors.push(`${label} is missing token: ${token}`);
}

function forbidToken(content, token, label, errors) {
  if (content.includes(token)) errors.push(`${label} contains forbidden stale token: ${token}`);
}

function auditManualTasksSnapshot({ csvText, pageHtml }) {
  const errors = [];
  const rows = parseCsv(csvText || '');
  const [headers, ...items] = rows;
  errors.push(...validateHeaders(headers, expectedHeaders, 'github_manual_tasks.csv'));

  const seen = new Map();
  for (const [index, item] of items.entries()) {
    const line = index + 2;
    const [issueNumber, title, group, status, siteTool, sourceFile, successCriteria, nextAction, date] = item;

    if (!/^\d+$/.test(issueNumber || '')) errors.push(`line ${line}: invalid issue_number ${issueNumber}`);
    if (seen.has(issueNumber)) errors.push(`line ${line}: duplicate issue_number ${issueNumber}`);
    seen.set(issueNumber, item);

    if (!title) errors.push(`line ${line}: missing title`);
    if (!manualTaskGroups.has(group)) errors.push(`line ${line}: unsupported group ${group}`);
    if (!manualTaskStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!siteTool) errors.push(`line ${line}: missing site_tool`);
    if (siteTool && !repoPathExists(siteTool)) errors.push(`line ${line}: missing site_tool target ${siteTool}`);
    if (!sourceFile) errors.push(`line ${line}: missing source_file`);
    if (sourceFile && !repoPathExists(sourceFile)) errors.push(`line ${line}: missing source_file target ${sourceFile}`);
    if (!successCriteria || successCriteria.length < 40) errors.push(`line ${line}: success_criteria is missing or too short`);
    if (!nextAction || nextAction.length < 30) errors.push(`line ${line}: next_action is missing or too short`);
    if (!isIsoDate(date)) errors.push(`line ${line}: invalid created_or_updated ${date}`);
    if (isIsoDate(date) && date < '2026-07-15') errors.push(`line ${line}: stale created_or_updated ${date}`);

    const expected = expectedTasks[issueNumber];
    if (!expected) {
      errors.push(`line ${line}: unexpected manual task ${issueNumber}`);
      continue;
    }

    for (const [field, actual, expectedValue] of [
      ['title', title, expected.title],
      ['group', group, expected.group],
      ['status', status, expected.status],
      ['site_tool', siteTool, expected.siteTool],
      ['source_file', sourceFile, expected.sourceFile]
    ]) {
      if (actual !== expectedValue) errors.push(`line ${line}: ${issueNumber} ${field} must equal ${expectedValue}`);
    }
  }

  for (const issueNumber of Object.keys(expectedTasks)) {
    if (!seen.has(issueNumber)) errors.push(`missing required manual task ${issueNumber}`);
  }
  if (seen.has('165')) errors.push('closed issue 165 must not remain in github_manual_tasks.csv');
  if (seen.size !== Object.keys(expectedTasks).length) {
    errors.push(`manual task count must equal ${Object.keys(expectedTasks).length}, found ${seen.size}`);
  }

  const pageIssueIds = Array.from(pageHtml.matchAll(/data-manual-issue="(\d+)"/g), (match) => match[1]);
  const uniquePageIds = new Set(pageIssueIds);
  if (pageIssueIds.length !== uniquePageIds.size) errors.push('github-tasks page contains duplicate issue cards');
  if (pageIssueIds.join(',') !== expectedPageIssueIds.join(',')) {
    errors.push(`github-tasks page issue order must be ${expectedPageIssueIds.join(',')}, found ${pageIssueIds.join(',')}`);
  }

  for (const token of [
    '<meta name="robots" content="noindex,follow"/>',
    'Сводка актуализирована 15 июля 2026 года',
    'data-manual-issue="34"',
    'data-manual-issue="164"',
    'data-manual-issue="166"',
    'data-manual-issue="205"',
    'data-manual-issue="254"',
    'actions-012',
    'Settings → Pages',
    'pre_legal_readiness',
    '13 / 9 / 2',
    '/data/github_manual_tasks.csv',
    '/data/user_decision_queue.csv'
  ]) requireToken(pageHtml, token, 'github-tasks page', errors);

  for (const token of [
    'data-manual-issue="165"',
    '<h2>#165',
    'commit endpoint не показал workflow-runs',
    'Сводка составлена 25 июня 2026 года',
    'CSS-регрессия'
  ]) forbidToken(pageHtml, token, 'github-tasks page', errors);

  return errors;
}

function auditRepositoryContract() {
  const errors = [];
  const packageText = readRequired(PACKAGE_PATH, 'package.json', errors);
  const projectMode = readRequired(PROJECT_MODE_PATH, 'project mode', errors);
  const projectModeFull = readRequired(PROJECT_MODE_FULL_PATH, 'full project mode', errors);
  const workflow = readRequired(WORKFLOW_PATH, 'manual tasks workflow', errors);
  const docs = readRequired(DOCS_PATH, 'manual tasks governance documentation', errors);

  let packageJson = null;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    errors.push(`package.json is invalid JSON: ${error.message}`);
  }

  if (packageJson) {
    const scripts = packageJson.scripts || {};
    if (scripts['test:manual-tasks'] !== 'node scripts/test_github_manual_tasks.js') {
      errors.push('package.json must define test:manual-tasks');
    }
    if (scripts['audit:github-manual-tasks'] !== 'node scripts/audit_github_manual_tasks.js') {
      errors.push('package.json must define audit:github-manual-tasks');
    }
    const auditAll = String(scripts['audit:all'] || '');
    for (const command of ['npm run test:manual-tasks', 'npm run audit:github-manual-tasks']) {
      if (!auditAll.includes(command)) errors.push(`audit:all is missing ${command}`);
    }
  }

  for (const [label, content] of [
    ['project mode', projectMode],
    ['full project mode', projectModeFull]
  ]) {
    requireToken(content, 'scripts/test_github_manual_tasks.js', label, errors);
    requireToken(content, 'scripts/audit_github_manual_tasks.js', label, errors);
  }

  for (const token of [
    'pull_request:',
    'contents: read',
    'npm run test:manual-tasks',
    'npm run audit:github-manual-tasks',
    'node scripts/audit_user_decision_queue.js',
    'node scripts/audit_project_mode_full.js'
  ]) requireToken(workflow, token, 'manual tasks workflow', errors);
  for (const token of ['contents: write', 'git push', 'git-auto-commit']) {
    forbidToken(workflow, token, 'manual tasks workflow', errors);
  }

  for (const token of [
    'Закрытая issue #165',
    'issues #34, #164, #166, #205 и #254',
    'не обращается к GitHub API',
    'data-manual-issue',
    'read-only'
  ]) requireToken(docs, token, 'manual tasks governance documentation', errors);

  return errors;
}

function main() {
  const errors = [];
  const csvText = readRequired(CSV_PATH, 'github_manual_tasks.csv', errors);
  const pageHtml = readRequired(PAGE_PATH, 'github-tasks page', errors);
  errors.push(...auditManualTasksSnapshot({ csvText, pageHtml }));
  errors.push(...auditRepositoryContract());

  if (errors.length) {
    throw new Error(`Manual tasks governance audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Manual tasks governance OK: ${Object.keys(expectedTasks).length} rows, ${expectedPageIssueIds.length} issue cards`);
}

module.exports = {
  auditManualTasksSnapshot,
  auditRepositoryContract,
  expectedPageIssueIds,
  expectedTasks
};

if (require.main === module) main();
