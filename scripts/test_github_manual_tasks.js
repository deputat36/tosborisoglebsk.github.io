const fs = require('fs');
const path = require('path');
const { auditManualTasksSnapshot } = require('./audit_github_manual_tasks');

const ROOT = process.cwd();
const csvText = fs.readFileSync(path.join(ROOT, 'data', 'github_manual_tasks.csv'), 'utf8');
const pageHtml = fs.readFileSync(path.join(ROOT, 'github-tasks', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const validErrors = auditManualTasksSnapshot({ csvText, pageHtml });
assert(validErrors.length === 0, `Current manual tasks snapshot must pass: ${validErrors.join('; ')}`);

const closedIssueCsv = csvText.replace(/^205,/m, '165,');
const closedIssueErrors = auditManualTasksSnapshot({ csvText: closedIssueCsv, pageHtml });
assert(
  closedIssueErrors.some((error) => error.includes('closed issue 165') || error.includes('unexpected manual task 165')),
  'Closed issue 165 must be rejected in CSV'
);
assert(
  closedIssueErrors.some((error) => error.includes('missing required manual task 205')),
  'Replacing issue 205 must expose the missing required blocker'
);

const staleCardHtml = pageHtml.replace('data-manual-issue="205"', 'data-manual-issue="165"');
const staleCardErrors = auditManualTasksSnapshot({ csvText, pageHtml: staleCardHtml });
assert(
  staleCardErrors.some((error) => error.includes('data-manual-issue="165"') || error.includes('issue order')),
  'Closed issue 165 must be rejected on the page'
);

const stalePagesHtml = `${pageHtml}\ncommit endpoint не показал workflow-runs`;
const stalePagesErrors = auditManualTasksSnapshot({ csvText, pageHtml: stalePagesHtml });
assert(
  stalePagesErrors.some((error) => error.includes('commit endpoint не показал workflow-runs')),
  'Old issue 164 explanation must be rejected'
);

const missingDecisionQueueCsv = csvText.replace(/\n0,.*$/m, '');
const missingDecisionQueueErrors = auditManualTasksSnapshot({ csvText: missingDecisionQueueCsv, pageHtml });
assert(
  missingDecisionQueueErrors.some((error) => error.includes('missing required manual task 0')),
  'Decision queue control row must remain required'
);

console.log('Manual tasks governance self-test OK');
