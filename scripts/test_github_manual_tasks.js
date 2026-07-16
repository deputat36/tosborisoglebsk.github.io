const fs = require('fs');
const path = require('path');
const { auditManualTasksSnapshot, auditManualTaskSources } = require('./audit_github_manual_tasks');

const ROOT = process.cwd();
const csvText = fs.readFileSync(path.join(ROOT, 'data', 'github_manual_tasks.csv'), 'utf8');
const pageHtml = fs.readFileSync(path.join(ROOT, 'github-tasks', 'index.html'), 'utf8');
const sources = {
  verificationCsv: fs.readFileSync(path.join(ROOT, 'data', 'verification_readiness_matrix.csv'), 'utf8'),
  pagesCsv: fs.readFileSync(path.join(ROOT, 'data', 'github_pages_manual_check_template.csv'), 'utf8'),
  outreachCsv: fs.readFileSync(path.join(ROOT, 'data', 'outreach_register.csv'), 'utf8'),
  personalDataCsv: fs.readFileSync(path.join(ROOT, 'data', 'personal_data_decision_packet.csv'), 'utf8'),
  publicationCsv: fs.readFileSync(path.join(ROOT, 'data', 'publication_basis_confirmation_register.csv'), 'utf8')
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const validErrors = auditManualTasksSnapshot({ csvText, pageHtml });
assert(validErrors.length === 0, `Current manual tasks snapshot must pass: ${validErrors.join('; ')}`);

const sourceErrors = auditManualTaskSources(sources);
assert(sourceErrors.length === 0, `Current manual blocker sources must pass: ${sourceErrors.join('; ')}`);

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

const missingVerificationRow = sources.verificationCsv.split(/\r?\n/).slice(0, -2).concat('').join('\n');
const missingVerificationErrors = auditManualTaskSources({ ...sources, verificationCsv: missingVerificationRow });
assert(
  missingVerificationErrors.some((error) => error.includes('issue 34: dashboard total must be 4')),
  'Dashboard audit must reject a missing priority card row'
);

const fakeSentOutreach = sources.outreachCsv.replace(',draft,,,,,,"не определены официальный адресат и канал"', ',sent,,,,,,"не определены официальный адресат и канал"');
const fakeSentErrors = auditManualTaskSources({ ...sources, outreachCsv: fakeSentOutreach });
assert(
  fakeSentErrors.some((error) => error.includes('issue 166: source contains')),
  'Dashboard audit must reject a fake sent outreach row without required fields'
);

console.log('Manual tasks governance self-test OK: snapshot and dynamic source summaries');
