const assert = require('assert');
const fs = require('fs');
const path = require('path');
const validation = require('../assets/js/media-permission-scenario-validation.js');

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
  const headers = (lines.shift() || '').split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

const csvPath = path.join(process.cwd(), 'data', 'media_permission_scenarios.csv');
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const summary = validation.summarize(rows);

assert.strictEqual(summary.total, 10, 'expected 10 media scenarios');
assert.strictEqual(summary.draft, 10, 'all scenarios must remain draft');
assert.strictEqual(summary.groups, 6, 'expected 6 scenario groups');
assert.strictEqual(summary.undecided, 10, 'no scope may be selected');
assert.strictEqual(summary.withoutEvidence, 10, 'no evidence reference may be present');
assert.strictEqual(summary.invalid, 0, 'matrix must have no validation issues');

const changedStatus = { ...rows[0], scenario_status: 'approved' };
assert(validation.validationIssues(changedStatus, 0).some((issue) => issue.includes('draft')));

const selectedScope = { ...rows[0], selected_permission_scope_code: 'public_all_surfaces' };
assert(validation.validationIssues(selectedScope, 0).some((issue) => issue.includes('selected_permission_scope_code')));

const addedEvidence = { ...rows[0], evidence_ref: 'evidence:example' };
assert(validation.validationIssues(addedEvidence, 0).some((issue) => issue.includes('evidence_ref')));

const wrongOrder = { ...rows[0], scenario_id: rows[1].scenario_id };
assert(validation.validationIssues(wrongOrder, 0).some((issue) => issue.includes('scenario_id')));

const duplicateCode = { ...rows[0], media_type_codes: 'photo;photo' };
assert(validation.validationIssues(duplicateCode, 0).some((issue) => issue.includes('повторяющиеся')));

console.log('Media permission scenarios self-test OK: 10 draft scenarios in 6 groups');
