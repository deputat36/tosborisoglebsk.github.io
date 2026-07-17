const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const validation = require('../assets/js/private-evidence-storage-validation.js');

const FILE_PATH = path.join(process.cwd(), 'data', 'private_evidence_storage_requirements.csv');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

const rows = rowsAsObjects(fs.readFileSync(FILE_PATH, 'utf8'));
assert(rows.length === 10, `expected 10 requirements, found ${rows.length}`);
rows.forEach((row, index) => {
  const issues = validation.validationIssues(row, index);
  assert(issues.length === 0, `requirement ${index + 1} must be valid: ${issues.join('; ')}`);
});

const summary = validation.summarize(rows);
assert(summary.total === 10, 'summary total must be 10');
assert(summary.draft === 10, 'all requirements must remain draft');
assert(summary.mandatory === 9, 'nine requirements must be mandatory');
assert(summary.candidateSlots === 30, 'matrix must expose 30 candidate slots');
assert(summary.notAssessed === 30, 'all candidate slots must remain not_assessed');
assert(summary.selected === 0, 'no candidate may be selected');
assert(summary.withRoles === 0, 'owner and reviewer roles must remain empty');
assert(summary.invalid === 0, 'canonical matrix must have no structural errors');

const changedStatus = rows.map((row) => ({ ...row }));
changedStatus[0].requirement_status = 'reviewed';
assert(validation.validationIssues(changedStatus[0], 0).some((issue) => issue.includes('draft')), 'non-draft status must be rejected');

const assessedCandidate = rows.map((row) => ({ ...row }));
assessedCandidate[1].candidate_a_result = 'passed';
assert(validation.validationIssues(assessedCandidate[1], 1).some((issue) => issue.includes('candidate_a_result')), 'candidate assessment must remain not_assessed');

const selectedCandidate = rows.map((row) => ({ ...row }));
selectedCandidate[2].selected_candidate_code = 'candidate_a';
assert(validation.validationIssues(selectedCandidate[2], 2).some((issue) => issue.includes('selected_candidate_code')), 'selected candidate must remain empty');

const secretMention = rows.map((row) => ({ ...row }));
secretMention[3].verification_method = 'проверить password в тестовой записи';
assert(validation.validationIssues(secretMention[3], 3).some((issue) => issue.includes('секрета')), 'secret-like content must be rejected');

const wrongOrder = rows.map((row) => ({ ...row }));
wrongOrder[4].requirement_id = 'access_control';
assert(validation.validationIssues(wrongOrder[4], 4).some((issue) => issue.includes('requirement_id')), 'wrong requirement order must be rejected');

console.log('Private evidence storage requirements tests OK: 10 draft criteria, 30 candidate slots not assessed');