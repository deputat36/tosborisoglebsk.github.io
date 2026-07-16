const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const validation = require('../assets/js/personal-data-decision-validation.js');

const ROOT = process.cwd();
const PACKET_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');
const READINESS_PATH = path.join(ROOT, 'data', 'personal_data_readiness.json');

const EXPECTED_HEADERS = [
  'decision_id',
  'sequence',
  'decision_status',
  'recommended_prerequisite_ids',
  'decision_owner_role',
  'legal_reviewer_role',
  'selected_option_code',
  'decision_ref',
  'legal_review_ref',
  'approved_at',
  'approved_by_role',
  'implementation_status',
  'implementation_ref',
  'implemented_at',
  'implemented_by_role',
  'blocker',
  'next_step'
];

const EXPECTED_DEPENDENCIES = new Map([
  ['operator_assignment', []],
  ['purposes_and_data_categories', ['operator_assignment']],
  ['processing_and_distribution_basis', ['operator_assignment', 'purposes_and_data_categories']],
  ['distribution_consent_form', ['operator_assignment', 'purposes_and_data_categories', 'processing_and_distribution_basis']],
  ['media_permission_form', ['operator_assignment', 'purposes_and_data_categories', 'processing_and_distribution_basis']],
  ['withdrawal_correction_and_deletion_process', ['operator_assignment', 'purposes_and_data_categories']],
  ['private_evidence_storage', ['operator_assignment', 'purposes_and_data_categories']],
  ['retention_access_and_incident_rules', ['operator_assignment', 'purposes_and_data_categories', 'private_evidence_storage']]
]);

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function rowsAsObjects(csvText) {
  const rows = parseCsv(csvText);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('personal_data_decision_packet.csv is empty');
  const headerErrors = validateHeaders(headers, EXPECTED_HEADERS, 'personal_data_decision_packet.csv');
  if (headerErrors.length) throw new Error(headerErrors.join('\n'));
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function sensitiveValue(value) {
  const text = String(value || '');
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)
    || /\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(text)
    || /https?:\/\//i.test(text);
}

function main() {
  const errors = [];
  const rows = rowsAsObjects(read(PACKET_PATH));
  const readiness = JSON.parse(read(READINESS_PATH));
  const canonical = Array.isArray(readiness.decisions) ? readiness.decisions : [];
  const canonicalById = new Map(canonical.map((item) => [item.id, item]));
  const rowById = new Map(rows.map((item) => [item.decision_id, item]));

  if (rows.length !== 8) errors.push(`decision packet must contain exactly 8 rows, found ${rows.length}`);
  if (canonical.length !== 8) errors.push(`personal_data_readiness.json must contain exactly 8 decisions, found ${canonical.length}`);
  if (rowById.size !== rows.length) errors.push('decision packet contains duplicate decision_id values');

  rows.forEach((row, index) => {
    const line = index + 2;
    const expectedId = canonical[index] && canonical[index].id;
    if (row.decision_id !== expectedId) errors.push(`line ${line}: packet order must match personal_data_readiness.json`);
    if (Number(row.sequence) !== index + 1) errors.push(`line ${line}: sequence must equal ${index + 1}`);

    const canonicalDecision = canonicalById.get(row.decision_id);
    validation.validationIssues(row, canonicalDecision, rows).forEach((issue) => {
      errors.push(`line ${line} (${row.decision_id || 'no-id'}): ${issue}`);
    });

    const expectedDependencies = EXPECTED_DEPENDENCIES.get(row.decision_id) || [];
    const actualDependencies = validation.prerequisiteIds(row);
    if (actualDependencies.join('|') !== expectedDependencies.join('|')) {
      errors.push(`line ${line}: recommended dependencies differ for ${row.decision_id}`);
    }

    if (!String(row.next_step || '').trim()) errors.push(`line ${line}: next_step is required`);
    if (['pending', 'blocked'].includes(row.decision_status) && !String(row.blocker || '').trim()) {
      errors.push(`line ${line}: ${row.decision_status} requires blocker`);
    }
    if (row.decision_status === 'approved' && String(row.blocker || '').trim()) {
      errors.push(`line ${line}: approved decision must not keep blocker`);
    }

    for (const [field, value] of Object.entries(row)) {
      if (sensitiveValue(value)) errors.push(`line ${line}: ${field} contains a contact or direct URL`);
    }
  });

  for (const decision of canonical) {
    if (!rowById.has(decision.id)) errors.push(`canonical decision is missing from packet: ${decision.id}`);
  }

  const operatorRow = rowById.get('operator_assignment');
  const operator = readiness.operator || {};
  if (operatorRow && operatorRow.decision_status !== operator.status) {
    errors.push('operator_assignment status must match operator.status');
  }
  if (operatorRow && operatorRow.decision_status === 'approved') {
    if (operatorRow.decision_ref !== operator.decision_ref) errors.push('approved operator decision_ref must match operator.decision_ref');
    if (operatorRow.approved_at !== operator.approved_at) errors.push('approved operator approved_at must match operator.approved_at');
    if (operatorRow.approved_by_role !== operator.approved_by) errors.push('approved operator approved_by_role must match operator.approved_by');
  }

  if (EXPECTED_HEADERS.some((header) => /name|email|phone|contact|raw|document_url/i.test(header))) {
    errors.push('decision packet schema must remain role-based and must not contain direct personal contact fields');
  }

  if (errors.length) {
    throw new Error(`Personal data decision packet audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  const statuses = rows.reduce((result, row) => {
    result[row.decision_status] = (result[row.decision_status] || 0) + 1;
    return result;
  }, {});
  const ready = rows.filter((row) => validation.isReadyForReview(row, rows)).length;
  const approved = rows.filter(validation.isApprovalComplete).length;
  console.log(`Personal data decision packet OK: 8 rows, ready ${ready}, approved ${approved}, statuses ${JSON.stringify(statuses)}`);
}

if (require.main === module) main();

module.exports = { EXPECTED_HEADERS, EXPECTED_DEPENDENCIES, rowsAsObjects };
