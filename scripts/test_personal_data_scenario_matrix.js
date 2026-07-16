const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const validation = require('../assets/js/personal-data-scenario-validation.js');

const FILE_PATH = path.join(process.cwd(), 'data', 'personal_data_scenario_matrix.csv');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

const rows = rowsAsObjects(fs.readFileSync(FILE_PATH, 'utf8'));
assert(rows.length === 4, `expected 4 scenarios, found ${rows.length}`);
rows.forEach((row, index) => {
  const issues = validation.validationIssues(row, index);
  assert(issues.length === 0, `scenario ${index + 1} must be valid: ${issues.join('; ')}`);
});

const summary = validation.summarize(rows);
assert(summary.total === 4, 'summary total must be 4');
assert(summary.draft === 4, 'all scenarios must remain draft');
assert(summary.missingBasis === 4, 'all scenarios must keep basis empty');
assert(summary.missingRetention === 4, 'all scenarios must keep retention empty');
assert(summary.invalid === 0, 'canonical matrix must have no structural errors');

const changedStatus = rows.map((row) => ({ ...row }));
changedStatus[0].scenario_status = 'reviewed';
assert(validation.validationIssues(changedStatus[0], 0).some((issue) => issue.includes('draft')), 'non-draft status must be rejected');

const selectedBasis = rows.map((row) => ({ ...row }));
selectedBasis[0].basis_code = 'option_a';
assert(validation.validationIssues(selectedBasis[0], 0).some((issue) => issue.includes('basis_code')), 'basis must remain empty');

const duplicateCode = rows.map((row) => ({ ...row }));
duplicateCode[1].action_codes = 'receive;receive';
assert(validation.validationIssues(duplicateCode[1], 1).some((issue) => issue.includes('повторяющиеся')), 'duplicate codes must be rejected');

const wrongOrder = rows.map((row) => ({ ...row }));
wrongOrder[2].scenario_id = 'public_tos_card';
assert(validation.validationIssues(wrongOrder[2], 2).some((issue) => issue.includes('scenario_id')), 'wrong scenario order must be rejected');

console.log('Personal data scenario matrix tests OK: 4 draft scenarios, external decision fields empty');
