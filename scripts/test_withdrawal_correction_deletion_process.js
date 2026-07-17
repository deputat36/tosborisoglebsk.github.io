const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const validation = require('../assets/js/withdrawal-correction-deletion-validation.js');

const FILE_PATH = path.join(process.cwd(), 'data', 'withdrawal_correction_deletion_process.csv');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

const rows = rowsAsObjects(fs.readFileSync(FILE_PATH, 'utf8'));
assert(rows.length === 8, `expected 8 stages, found ${rows.length}`);
rows.forEach((row, index) => {
  const issues = validation.validationIssues(row, index);
  assert(issues.length === 0, `stage ${index + 1} must be valid: ${issues.join('; ')}`);
});

const summary = validation.summarize(rows);
assert(summary.total === 8, 'summary total must be 8');
assert(summary.draft === 8, 'all stages must remain draft');
assert(summary.withoutOwner === 8, 'all stages must keep owner empty');
assert(summary.withoutChannel === 8, 'all stages must keep channel empty');
assert(summary.withoutTargetTime === 8, 'all stages must keep target time empty');
assert(summary.withoutEvidence === 8, 'all stages must keep evidence empty');
assert(summary.invalid === 0, 'canonical process must have no structural errors');

const changedStatus = { ...rows[0], stage_status: 'completed' };
assert(validation.validationIssues(changedStatus, 0).some((issue) => issue.includes('draft')), 'non-draft status must be rejected');

const assignedOwner = { ...rows[1], owner_role_code: 'operator_role' };
assert(validation.validationIssues(assignedOwner, 1).some((issue) => issue.includes('owner_role_code')), 'owner role must remain empty');

const selectedChannel = { ...rows[2], channel_code: 'email' };
assert(validation.validationIssues(selectedChannel, 2).some((issue) => issue.includes('channel_code')), 'channel must remain empty');

const selectedDeadline = { ...rows[3], target_time_code: 'three_days' };
assert(validation.validationIssues(selectedDeadline, 3).some((issue) => issue.includes('target_time_code')), 'target time must remain empty');

const duplicateCode = { ...rows[4], action_codes: 'apply_correction;apply_correction' };
assert(validation.validationIssues(duplicateCode, 4).some((issue) => issue.includes('повторяющиеся')), 'duplicate codes must be rejected');

const directContact = { ...rows[5], blocker: 'написать test@example.org' };
assert(validation.validationIssues(directContact, 5).some((issue) => issue.includes('контакт')), 'direct contact must be rejected');

console.log('Withdrawal correction deletion process tests OK: 8 draft stages, roles/channels/deadlines/evidence empty');
