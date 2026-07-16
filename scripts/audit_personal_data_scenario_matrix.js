const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const validation = require('../assets/js/personal-data-scenario-validation.js');
const { rowsAsObjects: decisionRowsAsObjects } = require('./audit_personal_data_decision_packet.js');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'personal_data_scenario_matrix.csv');
const PACKET_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');

const EXPECTED_HEADERS = [
  'scenario_id', 'sequence', 'scenario_status', 'scenario_title', 'draft_purpose',
  'actor_codes', 'source_codes', 'field_group_codes', 'public_output_codes',
  'internal_record_codes', 'action_codes', 'retention_class_code', 'basis_code',
  'distribution_rule_code', 'review_question_codes', 'blocker', 'next_step'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function matrixRows(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('personal_data_scenario_matrix.csv is empty');
  const headerErrors = validateHeaders(headers, EXPECTED_HEADERS, 'personal_data_scenario_matrix.csv');
  if (headerErrors.length) throw new Error(headerErrors.join('\n'));
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function main() {
  const errors = [];
  const rows = matrixRows(read(MATRIX_PATH));
  if (rows.length !== 4) errors.push(`scenario matrix must contain exactly 4 rows, found ${rows.length}`);
  rows.forEach((row, index) => {
    validation.validationIssues(row, index).forEach((issue) => errors.push(`line ${index + 2}: ${issue}`));
  });

  const summary = validation.summarize(rows);
  if (summary.draft !== 4) errors.push('all scenario rows must remain draft');
  if (summary.missingBasis !== 4) errors.push('basis fields must remain empty in all scenarios');
  if (summary.missingRetention !== 4) errors.push('retention fields must remain empty in all scenarios');
  if (summary.invalid !== 0) errors.push(`scenario matrix has ${summary.invalid} invalid rows`);

  const decisions = decisionRowsAsObjects(read(PACKET_PATH));
  const target = decisions.find((row) => row.decision_id === 'purposes_and_data_categories');
  if (!target) errors.push('decision packet is missing purposes_and_data_categories');
  else {
    if (target.decision_status !== 'pending') errors.push('purposes_and_data_categories must remain pending');
    for (const field of ['decision_owner_role', 'legal_reviewer_role', 'selected_option_code', 'decision_ref', 'legal_review_ref', 'approved_at', 'approved_by_role']) {
      if (String(target[field] || '').trim()) errors.push(`purposes_and_data_categories.${field} must remain empty`);
    }
    if (target.implementation_status !== 'not_started') errors.push('purposes_and_data_categories implementation must remain not_started');
  }

  if (errors.length) {
    throw new Error(`Personal data scenario matrix audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Personal data scenario matrix OK: 4 draft scenarios, decision 2 remains pending');
}

if (require.main === module) main();
module.exports = { EXPECTED_HEADERS, matrixRows };
