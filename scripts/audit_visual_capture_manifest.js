const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const MATRIX_PATH = path.resolve(ROOT, process.env.VISUAL_BASELINE_MATRIX || 'data/css_regression_matrix.csv');
const OUTPUT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const STRICT_QUALITY = String(process.env.VISUAL_CAPTURE_STRICT_QUALITY || '').toLowerCase() === 'true';
const FOCUS_CONTRACTS = Object.freeze({
  'focus-catalog': Object.freeze({ selector: '#catalog', readySelector: '#tos-list .card' }),
  'focus-places': Object.freeze({ selector: '#places-browser', readySelector: '#places-grid .card' })
});

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readMatrixRecords() {
  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
  const idIndex = headers.indexOf('case_id');
  const interactionIndex = headers.indexOf('interaction');
  if (idIndex < 0) throw new Error('CSS regression matrix is missing case_id');
  if (interactionIndex < 0) throw new Error('CSS regression matrix is missing interaction');
  return rows.slice(1).map((row) => ({
    case_id: String(row[idIndex] || '').trim(),
    interaction: String(row[interactionIndex] || '').trim()
  })).filter((item) => item.case_id);
}

function auditFocusCapture(errors, label, expected, item) {
  const contract = FOCUS_CONTRACTS[expected.interaction];
  if (!contract) {
    if (item.focus_capture != null) errors.push(`${label}: unexpected focus_capture for ${expected.interaction}`);
    return;
  }

  const focus = item.focus_capture;
  if (!focus || typeof focus !== 'object') {
    errors.push(`${label}: focus_capture is missing`);
    return;
  }
  if (focus.selector !== contract.selector) errors.push(`${label}: focus selector ${focus.selector} does not match ${contract.selector}`);
  if (focus.ready_selector !== contract.readySelector) errors.push(`${label}: ready selector ${focus.ready_selector} does not match ${contract.readySelector}`);
  if (!Number.isInteger(focus.ready_count) || focus.ready_count < 1) errors.push(`${label}: ready_count must be at least 1`);
  if (focus.visible !== true) errors.push(`${label}: focused section is not visible`);
  if (!Number.isFinite(Number(focus.scrollY)) || Number(focus.scrollY) <= 0) errors.push(`${label}: focused capture did not scroll below the page top`);
  if (!Number.isFinite(Number(focus.width)) || Number(focus.width) <= 0) errors.push(`${label}: focused section width is invalid`);
  if (!Number.isFinite(Number(focus.height)) || Number(focus.height) <= 0) errors.push(`${label}: focused section height is invalid`);
}

function main() {
  const errors = [];
  const qualityFindings = [];

  if (!fs.existsSync(MATRIX_PATH)) errors.push(`missing matrix ${path.relative(ROOT, MATRIX_PATH)}`);
  if (!fs.existsSync(MANIFEST_PATH)) errors.push(`missing capture manifest ${path.relative(ROOT, MANIFEST_PATH)}`);
  if (errors.length) throw new Error(`Visual capture manifest audit failed:\n${errors.join('\n')}`);

  const expectedRecords = readMatrixRecords();
  const expectedIds = expectedRecords.map((item) => item.case_id);
  const expectedById = new Map(expectedRecords.map((item) => [item.case_id, item]));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const results = Array.isArray(manifest.results) ? manifest.results : [];
  const resultIds = results.map((item) => item.case_id);

  if (manifest.schema_version !== 3) errors.push(`unsupported schema_version ${manifest.schema_version}`);
  if (manifest.cases_total !== expectedIds.length) errors.push(`cases_total ${manifest.cases_total} does not match matrix ${expectedIds.length}`);
  if (manifest.cases_captured !== expectedIds.length) errors.push(`cases_captured ${manifest.cases_captured} does not match matrix ${expectedIds.length}`);
  if ((manifest.failures || []).length) errors.push(`runtime failures: ${(manifest.failures || []).length}`);

  const manifestQualityFailures = Array.isArray(manifest.quality_failures) ? manifest.quality_failures : [];
  if (manifestQualityFailures.length) {
    qualityFindings.push(...manifestQualityFailures.map((item) => `${item.case_id}: ${(item.violations || []).join('; ')}`));
    if (STRICT_QUALITY) errors.push(`quality failures: ${manifestQualityFailures.length}`);
  }

  const duplicateIds = resultIds.filter((id, index) => resultIds.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`duplicate captured case ids: ${[...new Set(duplicateIds)].join(', ')}`);

  expectedIds.forEach((caseId) => {
    if (!resultIds.includes(caseId)) errors.push(`missing captured case ${caseId}`);
  });
  resultIds.forEach((caseId) => {
    if (!expectedIds.includes(caseId)) errors.push(`unexpected captured case ${caseId}`);
  });

  results.forEach((item, index) => {
    const label = item.case_id || `result ${index + 1}`;
    const expected = expectedById.get(item.case_id);
    const screenshot = path.join(OUTPUT_DIR, item.screenshot || `${item.case_id}.png`);
    if (!fs.existsSync(screenshot)) {
      errors.push(`${label}: screenshot is missing`);
      return;
    }
    if (!expected) {
      errors.push(`${label}: matrix record is missing`);
      return;
    }
    if (item.interaction !== expected.interaction) errors.push(`${label}: interaction ${item.interaction} does not match matrix ${expected.interaction}`);
    auditFocusCapture(errors, label, expected, item);
    if (item.sha256 !== sha256(screenshot)) errors.push(`${label}: sha256 does not match screenshot`);
    if (Number(item.bytes) !== fs.statSync(screenshot).size) errors.push(`${label}: byte size does not match screenshot`);
    if ((item.console_errors || []).length) errors.push(`${label}: console errors are present`);
    if ((item.page_errors || []).length) errors.push(`${label}: page errors are present`);
    if ((item.failed_requests || []).length) errors.push(`${label}: failed requests are present`);

    const technicalViolations = Array.isArray(item.technical_violations) ? item.technical_violations : [];
    if (technicalViolations.length && !qualityFindings.some((finding) => finding.startsWith(`${label}:`))) {
      qualityFindings.push(`${label}: ${technicalViolations.join('; ')}`);
    }
    if (STRICT_QUALITY && technicalViolations.length) errors.push(`${label}: technical violations are present`);
    if (STRICT_QUALITY && item.diagnostics?.horizontalOverflow) errors.push(`${label}: horizontal overflow is present`);
  });

  if (errors.length) {
    throw new Error(`Visual capture manifest audit failed (${STRICT_QUALITY ? 'strict' : 'measurement'} mode):\n${errors.join('\n')}`);
  }

  if (qualityFindings.length) {
    console.log(`Visual capture manifest measured ${results.length} cases with ${qualityFindings.length} quality findings:`);
    qualityFindings.forEach((finding) => console.log(`- ${finding}`));
    if (!STRICT_QUALITY) console.log('Quality findings are recorded but do not block until an approved baseline exists.');
    return;
  }

  const focusedCount = expectedRecords.filter((item) => FOCUS_CONTRACTS[item.interaction]).length;
  console.log(`Visual capture manifest OK (${STRICT_QUALITY ? 'strict' : 'measurement'} mode): ${results.length} cases, ${focusedCount} focused dynamic cases, no runtime, quality, overflow or request failures`);
}

main();
