const fs = require('fs');
const path = require('path');
const { auditPlanSnapshot } = require('./audit_autonomous_improvement_plan');

const ROOT = process.cwd();
const planCsvText = fs.readFileSync(path.join(ROOT, 'data', 'autonomous_improvement_plan.csv'), 'utf8');
const planDocText = fs.readFileSync(path.join(ROOT, 'docs', 'AUTONOMOUS-WORK-PLAN.md'), 'utf8');
const manualTasksCsvText = fs.readFileSync(path.join(ROOT, 'data', 'github_manual_tasks.csv'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function audit(overrides = {}) {
  return auditPlanSnapshot({
    planCsvText: overrides.planCsvText || planCsvText,
    planDocText: overrides.planDocText || planDocText,
    manualTasksCsvText: overrides.manualTasksCsvText || manualTasksCsvText
  });
}

function expectFailure(errors, token, label) {
  assert(errors.length > 0, `${label}: mutation must fail`);
  assert(errors.some((error) => error.includes(token)), `${label}: expected error containing ${token}; got ${errors.join(' | ')}`);
}

const baseErrors = audit();
assert(baseErrors.length === 0, `current autonomous plan must pass: ${baseErrors.join(' | ')}`);

const staleIssueDoc = planDocText.replace(
  'Этот список должен совпадать',
  '- #165 — провести CSS-рефакторинг после визуальной регрессии.\n\nЭтот список должен совпадать'
);
expectFailure(audit({ planDocText: staleIssueDoc }), 'closed issue 165', 'closed issue regression');

const missingLegalIssueDoc = planDocText.replace(/^- #205 —.*\n/m, '');
expectFailure(audit({ planDocText: missingLegalIssueDoc }), 'open issue list must match', 'missing issue 205');

const activeCssPlan = planCsvText.replace(/(\n9,[^\n]*),done(?=\n)/, '$1,active');
expectFailure(audit({ planCsvText: activeCssPlan }), 'stage 9: status must equal done', 'CSS stage regression');

const missingPublicationStage = planCsvText
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('16,'))
  .join('\n');
expectFailure(audit({ planCsvText: missingPublicationStage }), 'missing required stage 16', 'publication basis stage regression');

console.log('Autonomous improvement plan self-test OK');
