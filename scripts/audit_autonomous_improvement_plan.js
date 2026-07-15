const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { extractRepoPathTokens, repoPathExists } = require('./lib/path_checks');
const { priorities, workModes, planStatuses } = require('./lib/status_sets');

const ROOT = process.cwd();
const PLAN_CSV_PATH = path.join(ROOT, 'data', 'autonomous_improvement_plan.csv');
const PLAN_DOC_PATH = path.join(ROOT, 'docs', 'AUTONOMOUS-WORK-PLAN.md');
const MANUAL_TASKS_PATH = path.join(ROOT, 'data', 'github_manual_tasks.csv');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

const expectedHeaders = ['stage', 'priority', 'area', 'task', 'mode', 'deliverable', 'status'];
const expectedManualTaskHeaders = [
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

const requiredStageContracts = {
  '8': {
    area: 'technical',
    status: 'waiting_for_manual_check',
    taskToken: 'Settings > Pages'
  },
  '9': {
    area: 'frontend',
    status: 'done',
    taskToken: 'CSS'
  },
  '15': {
    area: 'legal-readiness',
    status: 'waiting_for_manual_check',
    taskToken: 'юридическую модель'
  },
  '16': {
    area: 'publication-basis',
    status: 'waiting_for_confirmed_data',
    taskToken: '24 карточкам'
  },
  '17': {
    area: 'project-control',
    status: 'done',
    taskToken: 'ручные блокеры'
  }
};

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
  if (content.includes(token)) errors.push(`${label} contains stale token: ${token}`);
}

function parseOpenManualIssueIds(manualTasksCsvText, errors) {
  const rows = parseCsv(manualTasksCsvText || '');
  const [headers, ...items] = rows;
  errors.push(...validateHeaders(headers, expectedManualTaskHeaders, 'github_manual_tasks.csv'));
  if (!headers) return [];

  const issueIndex = headers.indexOf('issue_number');
  const statusIndex = headers.indexOf('status');
  if (issueIndex < 0 || statusIndex < 0) return [];

  return items
    .filter((item) => item[statusIndex] === 'open' && item[issueIndex] !== '0')
    .map((item) => item[issueIndex]);
}

function extractDocumentIssueIds(planDocText, errors) {
  const heading = '## 8. Текущие открытые GitHub-задачи';
  const start = planDocText.indexOf(heading);
  if (start < 0) {
    errors.push(`AUTONOMOUS-WORK-PLAN.md is missing section: ${heading}`);
    return [];
  }

  const afterHeading = start + heading.length;
  const nextHeading = planDocText.indexOf('\n## ', afterHeading);
  const section = planDocText.slice(afterHeading, nextHeading < 0 ? planDocText.length : nextHeading);
  return Array.from(section.matchAll(/^- #(\d+) —/gm), (match) => match[1]);
}

function auditPlanSnapshot({ planCsvText, planDocText, manualTasksCsvText }) {
  const errors = [];
  const rows = parseCsv(planCsvText || '');
  const [headers, ...items] = rows;
  errors.push(...validateHeaders(headers, expectedHeaders, 'autonomous_improvement_plan.csv'));

  const stages = new Map();
  let previousStage = -1;

  items.forEach((item, index) => {
    const line = index + 2;
    const [stage, priority, area, task, mode, deliverable, status] = item;
    const stageNumber = Number(stage);

    if (!/^\d+$/.test(stage || '')) errors.push(`line ${line}: invalid stage ${stage}`);
    if (stages.has(stage)) errors.push(`line ${line}: duplicate stage ${stage}`);
    stages.set(stage, { priority, area, task, mode, deliverable, status });

    if (Number.isInteger(stageNumber) && stageNumber <= previousStage) {
      errors.push(`line ${line}: stages must be strictly ascending`);
    }
    if (Number.isInteger(stageNumber)) previousStage = stageNumber;

    if (!priorities.has(priority)) errors.push(`line ${line}: unsupported priority ${priority}`);
    if (!area) errors.push(`line ${line}: missing area`);
    if (!task) errors.push(`line ${line}: missing task`);
    if (!workModes.has(mode)) errors.push(`line ${line}: unsupported mode ${mode}`);
    if (!deliverable) errors.push(`line ${line}: missing deliverable`);
    if (!planStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);

    extractRepoPathTokens(deliverable).forEach((token) => {
      if (!repoPathExists(token)) errors.push(`line ${line}: missing deliverable target ${token}`);
    });
  });

  if (items.length !== 18) errors.push(`autonomous plan must contain 18 stages, found ${items.length}`);

  for (let stage = 0; stage <= 17; stage += 1) {
    if (!stages.has(String(stage))) errors.push(`missing required stage ${stage}`);
  }

  for (const [stage, contract] of Object.entries(requiredStageContracts)) {
    const row = stages.get(stage);
    if (!row) continue;
    if (row.area !== contract.area) errors.push(`stage ${stage}: area must equal ${contract.area}`);
    if (row.status !== contract.status) errors.push(`stage ${stage}: status must equal ${contract.status}`);
    if (!row.task.includes(contract.taskToken)) errors.push(`stage ${stage}: task must include ${contract.taskToken}`);
  }

  for (const token of [
    'Обновлено: 15 июля 2026 года.',
    'Production generation и public deployment smoke подтверждены.',
    'Закрытая issue #165 больше не является открытым блокером.',
    'режима `pre_legal_readiness`',
    'очереди `13 / 9 / 2`',
    'Settings → Pages',
    'data/github_manual_tasks.csv'
  ]) requireToken(planDocText, token, 'AUTONOMOUS-WORK-PLAN.md', errors);

  for (const token of [
    'Дата фиксации: 25 июня 2026 года.',
    '- #165 — провести CSS-рефакторинг после визуальной регрессии.',
    'использовать `/css-maintenance/` и задачу #165'
  ]) forbidToken(planDocText, token, 'AUTONOMOUS-WORK-PLAN.md', errors);

  const manualIssueIds = parseOpenManualIssueIds(manualTasksCsvText, errors);
  const documentIssueIds = extractDocumentIssueIds(planDocText, errors);
  if (documentIssueIds.join(',') !== manualIssueIds.join(',')) {
    errors.push(`open issue list must match github_manual_tasks.csv: expected ${manualIssueIds.join(',')}, found ${documentIssueIds.join(',')}`);
  }

  if (documentIssueIds.includes('165')) errors.push('closed issue 165 must not remain in the current open issue section');

  return errors;
}

function auditRepositoryContract() {
  const errors = [];
  const packageText = readRequired(PACKAGE_PATH, 'package.json', errors);
  const projectMode = readRequired(PROJECT_MODE_PATH, 'project mode', errors);
  const projectModeFull = readRequired(PROJECT_MODE_FULL_PATH, 'full project mode', errors);

  let packageJson = null;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    errors.push(`package.json is invalid JSON: ${error.message}`);
  }

  if (packageJson) {
    const scripts = packageJson.scripts || {};
    if (scripts['test:autonomous-improvement-plan'] !== 'node scripts/test_autonomous_improvement_plan.js') {
      errors.push('package.json must define test:autonomous-improvement-plan');
    }
    if (scripts['audit:autonomous-improvement-plan'] !== 'node scripts/audit_autonomous_improvement_plan.js') {
      errors.push('package.json must define audit:autonomous-improvement-plan');
    }
    const auditAll = String(scripts['audit:all'] || '');
    for (const command of ['npm run test:autonomous-improvement-plan', 'npm run audit:autonomous-improvement-plan']) {
      if (!auditAll.includes(command)) errors.push(`audit:all is missing ${command}`);
    }
  }

  for (const [label, content] of [
    ['project mode', projectMode],
    ['full project mode', projectModeFull]
  ]) {
    requireToken(content, 'scripts/test_autonomous_improvement_plan.js', label, errors);
    requireToken(content, 'scripts/audit_autonomous_improvement_plan.js', label, errors);
  }

  return errors;
}

function main() {
  const errors = [];
  const planCsvText = readRequired(PLAN_CSV_PATH, 'autonomous improvement plan CSV', errors);
  const planDocText = readRequired(PLAN_DOC_PATH, 'autonomous work plan document', errors);
  const manualTasksCsvText = readRequired(MANUAL_TASKS_PATH, 'manual tasks CSV', errors);

  errors.push(...auditPlanSnapshot({ planCsvText, planDocText, manualTasksCsvText }));
  errors.push(...auditRepositoryContract());

  if (errors.length) {
    throw new Error(`Autonomous improvement plan audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Autonomous improvement plan OK: 18 stages, 5 synchronized open issues');
}

module.exports = {
  auditPlanSnapshot,
  auditRepositoryContract,
  extractDocumentIssueIds,
  parseOpenManualIssueIds,
  requiredStageContracts
};

if (require.main === module) main();
