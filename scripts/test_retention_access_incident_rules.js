const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const validation = require('../assets/js/retention-access-incident-validation.js');

const FILE_PATH = path.join(process.cwd(), 'data', 'retention_access_incident_rules.csv');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

const rows = rowsAsObjects(fs.readFileSync(FILE_PATH, 'utf8'));
assert(rows.length === 10, `expected 10 rules, found ${rows.length}`);
rows.forEach((row, index) => {
  const issues = validation.validationIssues(row, index);
  assert(issues.length === 0, `rule ${index + 1} must be valid: ${issues.join('; ')}`);
});

const summary = validation.summarize(rows);
assert(summary.total === 10, 'summary total must be 10');
assert(summary.draft === 10, 'all rules must remain draft');
assert(summary.domains === 6, 'matrix must contain 6 domains');
assert(summary.undecided === 10, 'all rules must remain undecided');
assert(summary.notStarted === 10, 'all rules must remain not_started');
assert(summary.invalid === 0, 'canonical matrix must have no structural errors');

const changedStatus = { ...rows[0], rule_status: 'approved' };
assert(validation.validationIssues(changedStatus, 0).some((issue) => issue.includes('draft')), 'non-draft status must be rejected');

const selectedDecision = { ...rows[1], decision_value_code: 'selected_option' };
assert(validation.validationIssues(selectedDecision, 1).some((issue) => issue.includes('decision_value_code')), 'selected rule must be rejected');

const assignedRole = { ...rows[2], decision_owner_role: 'operator' };
assert(validation.validationIssues(assignedRole, 2).some((issue) => issue.includes('decision_owner_role')), 'assigned role must be rejected');

const started = { ...rows[3], implementation_status: 'in_progress' };
assert(validation.validationIssues(started, 3).some((issue) => issue.includes('not_started')), 'started implementation must be rejected');

console.log('Retention access incident rules tests OK: 10 draft rules, 6 domains, external decisions empty');
