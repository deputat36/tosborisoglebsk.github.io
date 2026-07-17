const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const validation = require('../assets/js/private-evidence-storage-validation.js');
const { rowsAsObjects: decisionRowsAsObjects } = require('./audit_personal_data_decision_packet.js');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'private_evidence_storage_requirements.csv');
const PACKET_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');

const EXPECTED_HEADERS = [
  'requirement_id', 'sequence', 'requirement_status', 'requirement_group', 'requirement_title',
  'minimum_requirement', 'verification_method', 'criticality', 'candidate_a_result',
  'candidate_b_result', 'candidate_c_result', 'selected_candidate_code', 'owner_role_code',
  'reviewer_role_code', 'evidence_ref', 'blocker', 'next_step'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function matrixRows(text) {
  const rows = parseCsv(text);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('private_evidence_storage_requirements.csv is empty');
  const headerErrors = validateHeaders(headers, EXPECTED_HEADERS, 'private_evidence_storage_requirements.csv');
  if (headerErrors.length) throw new Error(headerErrors.join('\n'));
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function assertPendingDecision(errors, decisions, decisionId) {
  const target = decisions.find((row) => row.decision_id === decisionId);
  if (!target) {
    errors.push(`decision packet is missing ${decisionId}`);
    return;
  }
  if (target.decision_status !== 'pending') errors.push(`${decisionId} must remain pending`);
  for (const field of ['decision_owner_role', 'legal_reviewer_role', 'selected_option_code', 'decision_ref', 'legal_review_ref', 'approved_at', 'approved_by_role', 'implementation_ref', 'implemented_at', 'implemented_by_role']) {
    if (String(target[field] || '').trim()) errors.push(`${decisionId}.${field} must remain empty`);
  }
  if (target.implementation_status !== 'not_started') errors.push(`${decisionId} implementation must remain not_started`);
}

function main() {
  const errors = [];
  const rows = matrixRows(read(MATRIX_PATH));
  if (rows.length !== 10) errors.push(`storage requirements must contain exactly 10 rows, found ${rows.length}`);
  rows.forEach((row, index) => {
    validation.validationIssues(row, index).forEach((issue) => errors.push(`line ${index + 2}: ${issue}`));
  });

  const summary = validation.summarize(rows);
  if (summary.draft !== 10) errors.push('all storage requirement rows must remain draft');
  if (summary.mandatory !== 9) errors.push(`mandatory requirement count must be 9, found ${summary.mandatory}`);
  if (summary.candidateSlots !== 30 || summary.notAssessed !== 30) errors.push('all 30 candidate slots must remain not_assessed');
  if (summary.selected !== 0) errors.push('no storage candidate may be selected');
  if (summary.withRoles !== 0) errors.push('storage owner and reviewer roles must remain empty');
  if (summary.invalid !== 0) errors.push(`storage matrix has ${summary.invalid} invalid rows`);

  const decisions = decisionRowsAsObjects(read(PACKET_PATH));
  assertPendingDecision(errors, decisions, 'private_evidence_storage');
  assertPendingDecision(errors, decisions, 'retention_access_and_incident_rules');

  const storageDecision = decisions.find((row) => row.decision_id === 'private_evidence_storage');
  if (storageDecision && storageDecision.recommended_prerequisite_ids !== 'operator_assignment;purposes_and_data_categories') {
    errors.push('private_evidence_storage prerequisites must remain unchanged');
  }

  if (errors.length) {
    throw new Error(`Private evidence storage requirements audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Private evidence storage requirements OK: 10 draft criteria, decision 7 and dependent decision 8 remain pending');
}

if (require.main === module) main();
module.exports = { EXPECTED_HEADERS, matrixRows };