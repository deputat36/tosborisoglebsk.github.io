const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const validation = require('../assets/js/withdrawal-correction-deletion-validation.js');
const { rowsAsObjects: decisionRowsAsObjects } = require('./audit_personal_data_decision_packet.js');

const ROOT = process.cwd();
const PROCESS_PATH = path.join(ROOT, 'data', 'withdrawal_correction_deletion_process.csv');
const PACKET_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');

const EXPECTED_HEADERS = [
  'stage_id', 'sequence', 'stage_status', 'stage_title', 'draft_purpose',
  'request_type_codes', 'input_codes', 'action_codes', 'output_codes',
  'owner_role_code', 'reviewer_role_code', 'channel_code', 'target_time_code',
  'evidence_ref', 'blocker', 'next_step'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function processRows(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('withdrawal_correction_deletion_process.csv is empty');
  const headerErrors = validateHeaders(headers, EXPECTED_HEADERS, 'withdrawal_correction_deletion_process.csv');
  if (headerErrors.length) throw new Error(headerErrors.join('\n'));
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function main() {
  const errors = [];
  const rows = processRows(read(PROCESS_PATH));
  if (rows.length !== 8) errors.push(`process must contain exactly 8 rows, found ${rows.length}`);
  rows.forEach((row, index) => {
    validation.validationIssues(row, index).forEach((issue) => errors.push(`line ${index + 2}: ${issue}`));
  });

  const summary = validation.summarize(rows);
  if (summary.draft !== 8) errors.push('all process rows must remain draft');
  if (summary.withoutOwner !== 8) errors.push('owner_role_code must remain empty in all rows');
  if (summary.withoutChannel !== 8) errors.push('channel_code must remain empty in all rows');
  if (summary.withoutTargetTime !== 8) errors.push('target_time_code must remain empty in all rows');
  if (summary.withoutEvidence !== 8) errors.push('evidence_ref must remain empty in all rows');
  if (summary.invalid !== 0) errors.push(`process has ${summary.invalid} invalid rows`);

  const decisions = decisionRowsAsObjects(read(PACKET_PATH));
  const target = decisions.find((row) => row.decision_id === 'withdrawal_correction_and_deletion_process');
  if (!target) errors.push('decision packet is missing withdrawal_correction_and_deletion_process');
  else {
    if (target.decision_status !== 'pending') errors.push('withdrawal_correction_and_deletion_process must remain pending');
    for (const field of ['decision_owner_role', 'legal_reviewer_role', 'selected_option_code', 'decision_ref', 'legal_review_ref', 'approved_at', 'approved_by_role', 'implementation_ref', 'implemented_at', 'implemented_by_role']) {
      if (String(target[field] || '').trim()) errors.push(`withdrawal_correction_and_deletion_process.${field} must remain empty`);
    }
    if (target.implementation_status !== 'not_started') errors.push('withdrawal_correction_and_deletion_process implementation must remain not_started');
  }

  if (errors.length) {
    throw new Error(`Withdrawal correction deletion process audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Withdrawal correction deletion process OK: 8 draft stages, decision 6 remains pending');
}

if (require.main === module) main();
module.exports = { EXPECTED_HEADERS, processRows };
