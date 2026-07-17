const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const validation = require('../assets/js/retention-access-incident-validation.js');
const { rowsAsObjects: decisionRowsAsObjects } = require('./audit_personal_data_decision_packet.js');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'retention_access_incident_rules.csv');
const PACKET_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');
const EXPECTED_HEADERS = [
  'rule_id', 'sequence', 'rule_status', 'domain_code', 'rule_title',
  'draft_requirement_codes', 'verification_question_codes', 'decision_value_code',
  'decision_owner_role', 'legal_reviewer_role', 'approved_at', 'evidence_ref',
  'implementation_status', 'implementation_ref', 'blocker', 'next_step'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function matrixRows(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('retention_access_incident_rules.csv is empty');
  const errors = validateHeaders(headers, EXPECTED_HEADERS, 'retention_access_incident_rules.csv');
  if (errors.length) throw new Error(errors.join('\n'));
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function checkDecision(errors, decisions, decisionId) {
  const target = decisions.find((row) => row.decision_id === decisionId);
  if (!target) {
    errors.push(`decision packet is missing ${decisionId}`);
    return;
  }
  if (target.decision_status !== 'pending') errors.push(`${decisionId} must remain pending`);
  for (const field of ['decision_owner_role', 'legal_reviewer_role', 'selected_option_code', 'decision_ref', 'legal_review_ref', 'approved_at', 'approved_by_role']) {
    if (String(target[field] || '').trim()) errors.push(`${decisionId}.${field} must remain empty`);
  }
  if (target.implementation_status !== 'not_started') errors.push(`${decisionId} implementation must remain not_started`);
  for (const field of ['implementation_ref', 'implemented_at', 'implemented_by_role']) {
    if (String(target[field] || '').trim()) errors.push(`${decisionId}.${field} must remain empty`);
  }
}

function main() {
  const errors = [];
  const rows = matrixRows(read(MATRIX_PATH));
  if (rows.length !== 10) errors.push(`matrix must contain exactly 10 rows, found ${rows.length}`);
  rows.forEach((row, index) => validation.validationIssues(row, index).forEach((issue) => errors.push(`line ${index + 2}: ${issue}`)));

  const summary = validation.summarize(rows);
  if (summary.draft !== 10) errors.push('all rules must remain draft');
  if (summary.domains !== 6) errors.push('matrix must contain exactly 6 domains');
  if (summary.undecided !== 10) errors.push('all decision values must remain empty');
  if (summary.notStarted !== 10) errors.push('all implementations must remain not_started');
  if (summary.invalid !== 0) errors.push(`matrix has ${summary.invalid} invalid rows`);

  const decisions = decisionRowsAsObjects(read(PACKET_PATH));
  checkDecision(errors, decisions, 'private_evidence_storage');
  checkDecision(errors, decisions, 'retention_access_and_incident_rules');

  if (errors.length) throw new Error(`Retention access incident rules audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Retention access incident rules OK: 10 draft rules, decisions 7 and 8 remain pending');
}

if (require.main === module) main();
module.exports = { EXPECTED_HEADERS, matrixRows };
