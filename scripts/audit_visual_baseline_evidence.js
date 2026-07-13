const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const BASELINE_DIR = path.join(ROOT, 'docs', 'visual-baseline');
const MANIFEST_PATH = path.join(BASELINE_DIR, 'manifest.json');
const README_PATH = path.join(BASELINE_DIR, 'README.md');
const COMPARISON_REPORT_PATH = path.join(BASELINE_DIR, 'COMPARISON-2026-07-13.md');
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const errors = [];

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing visual baseline file ${path.relative(ROOT, filePath)}`);
    return false;
  }
  return true;
}

if (requireFile(MANIFEST_PATH) && requireFile(MATRIX_PATH) && requireFile(README_PATH) && requireFile(COMPARISON_REPORT_PATH)) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    errors.push(`manifest is invalid JSON: ${error.message}`);
  }

  if (manifest) {
    if (manifest.schema_version !== 2) errors.push(`unexpected manifest schema_version ${manifest.schema_version}`);
    if (manifest.cases_total !== 14 || manifest.cases_captured !== 14) {
      errors.push(`manifest must contain 14/14 cases, found ${manifest.cases_captured}/${manifest.cases_total}`);
    }
    if (!manifest.enforce_quality) errors.push('manifest must be captured with strict quality enforcement');
    if (!Array.isArray(manifest.failures) || manifest.failures.length) errors.push('manifest failures must be an empty array');
    if (!Array.isArray(manifest.quality_failures) || manifest.quality_failures.length) errors.push('manifest quality_failures must be an empty array');
    if (!manifest.approval || manifest.approval.status !== 'baseline_captured') errors.push('manifest approval.status must remain baseline_captured');
    if (!manifest.approval?.reviewed) errors.push('manifest approval.reviewed must be true');
    if (!manifest.approval?.reviewed_at) errors.push('manifest approval.reviewed_at is required');
    if (!manifest.approval?.source_workflow_run_id) errors.push('manifest approval.source_workflow_run_id is required');
    if (!manifest.approval?.source_head_sha) errors.push('manifest approval.source_head_sha is required');

    const results = Array.isArray(manifest.results) ? manifest.results : [];
    const resultById = new Map();
    results.forEach((result, index) => {
      const context = `manifest result ${index + 1}`;
      const caseId = normalize(result.case_id);
      if (!/^css-reg-\d{3}$/.test(caseId)) errors.push(`${context}: invalid case_id ${caseId}`);
      if (resultById.has(caseId)) errors.push(`${context}: duplicate case_id ${caseId}`);
      resultById.set(caseId, result);

      if (Array.isArray(result.technical_violations) && result.technical_violations.length) {
        errors.push(`${context}: technical_violations must be empty`);
      }
      if (Array.isArray(result.console_errors) && result.console_errors.length) errors.push(`${context}: console_errors must be empty`);
      if (Array.isArray(result.page_errors) && result.page_errors.length) errors.push(`${context}: page_errors must be empty`);
      if (Array.isArray(result.failed_requests) && result.failed_requests.length) errors.push(`${context}: failed_requests must be empty`);
      if (result.diagnostics?.horizontalOverflow) errors.push(`${context}: horizontalOverflow must be false`);

      const expectedName = `${caseId}.png`;
      if (result.screenshot !== expectedName) errors.push(`${context}: screenshot must be ${expectedName}`);
      const pngPath = path.join(BASELINE_DIR, expectedName);
      if (requireFile(pngPath)) {
        const actualHash = sha256(pngPath);
        if (actualHash !== normalize(result.sha256)) {
          errors.push(`${context}: SHA-256 mismatch for ${expectedName}`);
        }
        const actualBytes = fs.statSync(pngPath).size;
        if (Number(result.bytes) !== actualBytes) {
          errors.push(`${context}: byte size mismatch for ${expectedName}: ${actualBytes} != ${result.bytes}`);
        }
      }
    });

    const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
    if (rows.length !== 15) errors.push(`CSS regression matrix must contain 14 rows, found ${Math.max(0, rows.length - 1)}`);
    const seenMatrixIds = new Set();
    rows.slice(1).forEach((row, index) => {
      const caseId = normalize(row[0]);
      const status = normalize(row[9]);
      const evidenceRef = normalize(row[10]);
      const notes = normalize(row[11]);
      const expectedRef = `docs/visual-baseline/${caseId}.png`;
      if (seenMatrixIds.has(caseId)) errors.push(`matrix row ${index + 2}: duplicate case_id ${caseId}`);
      seenMatrixIds.add(caseId);
      if (status !== 'passed') errors.push(`matrix row ${index + 2}: status must be passed after comparator`);
      if (evidenceRef !== expectedRef) errors.push(`matrix row ${index + 2}: evidence_ref must be ${expectedRef}`);
      if (!notes.includes('pixel_identical=true') || !notes.includes('pixel_equivalent=true')) {
        errors.push(`matrix row ${index + 2}: notes must record successful comparator result`);
      }
      if (!resultById.has(caseId)) errors.push(`matrix row ${index + 2}: case missing from manifest ${caseId}`);
      if (!requireFile(path.join(ROOT, evidenceRef))) errors.push(`matrix row ${index + 2}: evidence file does not exist ${evidenceRef}`);
    });

    for (let index = 1; index <= 14; index += 1) {
      const caseId = `css-reg-${String(index).padStart(3, '0')}`;
      if (!resultById.has(caseId)) errors.push(`manifest is missing ${caseId}`);
      if (!seenMatrixIds.has(caseId)) errors.push(`matrix is missing ${caseId}`);
    }

    const pngFiles = fs.readdirSync(BASELINE_DIR).filter((name) => /^css-reg-\d{3}\.png$/.test(name)).sort();
    if (pngFiles.length !== 14) errors.push(`baseline directory must contain exactly 14 PNG files, found ${pngFiles.length}`);
  }
}

const readme = fs.existsSync(README_PATH) ? fs.readFileSync(README_PATH, 'utf8') : '';
[
  'Сценариев: 14',
  'Runtime failures: 0',
  'Quality failures: 0',
  'baseline_captured',
  'pixel comparator'
].forEach((token) => {
  if (!readme.includes(token)) errors.push(`visual baseline README must contain ${token}`);
});

const comparisonReport = fs.existsSync(COMPARISON_REPORT_PATH) ? fs.readFileSync(COMPARISON_REPORT_PATH, 'utf8') : '';
[
  'Comparator run: `29277336532`',
  'pixel_identical: 14',
  'pixel_equivalent: 14',
  'changed cases: 0',
  'missing current cases: 0',
  'unexpected current cases: 0',
  'status `passed`'
].forEach((token) => {
  if (!comparisonReport.includes(token)) errors.push(`visual comparison report must contain ${token}`);
});

if (errors.length) {
  throw new Error(`Visual baseline evidence audit failed:\n${errors.join('\n')}`);
}

console.log('Visual baseline evidence audit OK: 14 PNG files, manifest hashes, passed matrix and comparison report verified');
