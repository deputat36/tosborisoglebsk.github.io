const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const MATRIX_PATH = path.resolve(ROOT, process.env.VISUAL_BASELINE_MATRIX || 'data/css_regression_matrix.csv');
const OUTPUT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readMatrixIds() {
  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
  const idIndex = headers.indexOf('case_id');
  if (idIndex < 0) throw new Error('CSS regression matrix is missing case_id');
  return rows.slice(1).map((row) => String(row[idIndex] || '').trim()).filter(Boolean);
}

function main() {
  const errors = [];

  if (!fs.existsSync(MATRIX_PATH)) errors.push(`missing matrix ${path.relative(ROOT, MATRIX_PATH)}`);
  if (!fs.existsSync(MANIFEST_PATH)) errors.push(`missing capture manifest ${path.relative(ROOT, MANIFEST_PATH)}`);
  if (errors.length) throw new Error(`Visual capture manifest audit failed:\n${errors.join('\n')}`);

  const expectedIds = readMatrixIds();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const results = Array.isArray(manifest.results) ? manifest.results : [];
  const resultIds = results.map((item) => item.case_id);

  if (manifest.schema_version !== 3) errors.push(`unsupported schema_version ${manifest.schema_version}`);
  if (manifest.cases_total !== expectedIds.length) errors.push(`cases_total ${manifest.cases_total} does not match matrix ${expectedIds.length}`);
  if (manifest.cases_captured !== expectedIds.length) errors.push(`cases_captured ${manifest.cases_captured} does not match matrix ${expectedIds.length}`);
  if ((manifest.failures || []).length) errors.push(`runtime failures: ${(manifest.failures || []).length}`);
  if ((manifest.quality_failures || []).length) errors.push(`quality failures: ${(manifest.quality_failures || []).length}`);

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
    const screenshot = path.join(OUTPUT_DIR, item.screenshot || `${item.case_id}.png`);
    if (!fs.existsSync(screenshot)) {
      errors.push(`${label}: screenshot is missing`);
      return;
    }
    if (item.sha256 !== sha256(screenshot)) errors.push(`${label}: sha256 does not match screenshot`);
    if (Number(item.bytes) !== fs.statSync(screenshot).size) errors.push(`${label}: byte size does not match screenshot`);
    if ((item.technical_violations || []).length) errors.push(`${label}: technical violations are present`);
    if ((item.console_errors || []).length) errors.push(`${label}: console errors are present`);
    if ((item.page_errors || []).length) errors.push(`${label}: page errors are present`);
    if ((item.failed_requests || []).length) errors.push(`${label}: failed requests are present`);
    if (item.diagnostics?.horizontalOverflow) errors.push(`${label}: horizontal overflow is present`);
  });

  if (errors.length) {
    throw new Error(`Visual capture manifest audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Visual capture manifest OK: ${results.length} cases, no runtime, quality, overflow or request failures`);
}

main();
