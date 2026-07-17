const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const validation = require('../assets/js/media-permission-scenario-validation.js');

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, 'data', 'media_permission_scenarios.csv');
const DECISIONS_PATH = path.join(ROOT, 'data', 'personal_data_decision_packet.csv');
const EXPECTED_HEADERS = [
  'scenario_id', 'sequence', 'scenario_status', 'scenario_group', 'scenario_title',
  'media_type_codes', 'participant_context_codes', 'publication_surface_codes',
  'verification_question_codes', 'selected_permission_scope_code',
  'selected_attribution_code', 'selected_duration_code', 'selected_withdrawal_route_code',
  'decision_owner_role', 'legal_reviewer_role', 'evidence_ref', 'blocker', 'next_step'
];

function readTable(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  const table = parseCsv(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''));
  const headers = table.shift() || [];
  const rows = table.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  return { headers, rows, widths: table.map((cells) => cells.length) };
}

function main() {
  const errors = [];
  const matrix = readTable(CSV_PATH);
  if (matrix.headers.join('|') !== EXPECTED_HEADERS.join('|')) errors.push('unexpected media scenario headers or order');
  if (matrix.rows.length !== 10) errors.push(`expected 10 rows, got ${matrix.rows.length}`);
  matrix.widths.forEach((width, index) => {
    if (width !== EXPECTED_HEADERS.length) errors.push(`row ${index + 2} has ${width} columns instead of ${EXPECTED_HEADERS.length}`);
  });
  matrix.rows.forEach((row, index) => {
    validation.validationIssues(row, index).forEach((issue) => errors.push(`${row.scenario_id || index + 1}: ${issue}`));
  });

  const summary = validation.summarize(matrix.rows);
  if (summary.total !== 10 || summary.draft !== 10 || summary.groups !== 6 || summary.undecided !== 10 || summary.withoutEvidence !== 10 || summary.invalid !== 0) {
    errors.push(`unexpected summary ${JSON.stringify(summary)}`);
  }

  const decisions = readTable(DECISIONS_PATH).rows;
  const byId = new Map(decisions.map((row) => [row.decision_id, row]));
  for (const id of ['operator_assignment', 'purposes_and_data_categories', 'processing_and_distribution_basis', 'media_permission_form']) {
    const row = byId.get(id);
    if (!row) errors.push(`missing decision ${id}`);
    else if (row.decision_status !== 'pending' || row.implementation_status !== 'not_started') {
      errors.push(`${id} must remain pending / not_started`);
    }
  }
  const mediaDecision = byId.get('media_permission_form');
  if (mediaDecision) {
    for (const field of ['decision_owner_role', 'legal_reviewer_role', 'selected_option_code', 'decision_ref', 'legal_review_ref', 'implementation_ref']) {
      if (String(mediaDecision[field] || '').trim()) errors.push(`media_permission_form.${field} must remain empty`);
    }
  }

  if (errors.length) throw new Error(`Media permission scenario audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Media permission scenarios OK: 10 draft scenarios, decision #5 pending');
}

main();
