const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const WORKFLOW_PATH = '.github/workflows/visual-capture.yml';
const CAPTURE_PATH = 'scripts/capture_visual_baseline.js';
const EVIDENCE_AUDIT_PATH = 'scripts/audit_visual_baseline_evidence.js';
const MATRIX_PATH = 'data/css_regression_matrix.csv';
const DOC_PATH = 'docs/VISUAL-CAPTURE.md';
const BASELINE_MANIFEST_PATH = 'docs/visual-baseline/manifest.json';
const errors = [];

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing required file ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

const workflow = read(WORKFLOW_PATH);
const capture = read(CAPTURE_PATH);
const evidenceAudit = read(EVIDENCE_AUDIT_PATH);
const matrixText = read(MATRIX_PATH);
const documentation = read(DOC_PATH);
const baselineManifestText = read(BASELINE_MANIFEST_PATH);

requireTokens(workflow, [
  'name: Capture visual evidence',
  'contents: read',
  "VISUAL_CAPTURE_ENFORCE_QUALITY: 'true'",
  'node --check scripts/capture_visual_baseline.js',
  'node --check scripts/audit_visual_baseline_evidence.js',
  'node scripts/audit_visual_overflow_fixes.js',
  'node scripts/audit_visual_baseline_evidence.js',
  'node scripts/capture_visual_baseline.js',
  'actions/upload-artifact@v4',
  'retention-days: 30'
], 'visual capture workflow');

[
  'contents: write',
  'git-auto-commit-action',
  'git push',
  'compare_visual_baseline.js',
  'VISUAL_BASELINE_APPROVED'
].forEach((token) => {
  if (workflow.includes(token)) errors.push(`visual capture workflow must not contain ${token}`);
});

requireTokens(capture, [
  'VISUAL_CAPTURE_ENFORCE_QUALITY',
  'technical_violations',
  'quality_failures',
  'failed_requests',
  'sha256',
  'internalOverflowElements',
  'overflowIsolationCandidates',
  'scrollWidth > entry.clientWidth + 1',
  "element.style.setProperty('overflow-x', 'hidden', 'important')",
  'if (failures.length)',
  'if (qualityFailures.length && ENFORCE_QUALITY)'
], 'visual capture script');

requireTokens(evidenceAudit, [
  'Visual baseline evidence audit OK',
  'SHA-256 mismatch',
  'baseline_captured',
  'fs.readdirSync(BASELINE_DIR)',
  'pngFiles.length !== 14'
], 'visual baseline evidence audit');

requireTokens(documentation, [
  'contents: read',
  '14 PNG',
  'VISUAL_CAPTURE_ENFORCE_QUALITY=true',
  'baseline_captured',
  'pixel comparator',
  'audit_visual_baseline_evidence.js'
], 'visual capture documentation');

let baselineManifest = null;
if (baselineManifestText) {
  try {
    baselineManifest = JSON.parse(baselineManifestText);
  } catch (error) {
    errors.push(`approved baseline manifest must be valid JSON: ${error.message}`);
  }
}
if (baselineManifest) {
  if (baselineManifest.cases_total !== 14 || baselineManifest.cases_captured !== 14) {
    errors.push(`approved baseline manifest must contain 14/14 cases, found ${baselineManifest.cases_captured}/${baselineManifest.cases_total}`);
  }
  if (!baselineManifest.enforce_quality) errors.push('approved baseline manifest must use strict quality enforcement');
  if (!Array.isArray(baselineManifest.failures) || baselineManifest.failures.length) errors.push('approved baseline manifest failures must be empty');
  if (!Array.isArray(baselineManifest.quality_failures) || baselineManifest.quality_failures.length) errors.push('approved baseline manifest quality_failures must be empty');
  if (baselineManifest.approval?.status !== 'baseline_captured') errors.push('approved baseline manifest status must be baseline_captured');
  if (baselineManifest.approval?.reviewed !== true) errors.push('approved baseline manifest must record reviewed=true');
}

if (matrixText) {
  const rows = parseCsv(matrixText);
  const headers = rows[0] || [];
  const expectedHeaders = [
    'case_id', 'area', 'route', 'viewport_width', 'viewport_height', 'theme',
    'interaction', 'mode', 'expected_check', 'status', 'evidence_ref', 'notes'
  ];
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected visual matrix headers: ${headers.join(', ')}`);
  }
  const cases = rows.slice(1);
  if (cases.length !== 14) errors.push(`visual matrix must contain 14 cases, found ${cases.length}`);
  const ids = new Set();
  cases.forEach((row, index) => {
    const id = String(row[0] || '').trim();
    const status = String(row[9] || '').trim();
    const evidence = String(row[10] || '').trim();
    const expectedEvidence = `docs/visual-baseline/${id}.png`;
    if (!/^css-reg-\d{3}$/.test(id)) errors.push(`matrix row ${index + 2}: invalid case_id ${id}`);
    if (ids.has(id)) errors.push(`matrix row ${index + 2}: duplicate case_id ${id}`);
    ids.add(id);
    if (status !== 'baseline_captured') errors.push(`matrix row ${index + 2}: status must be baseline_captured`);
    if (evidence !== expectedEvidence) errors.push(`matrix row ${index + 2}: evidence_ref must be ${expectedEvidence}`);
  });
}

if (errors.length) {
  throw new Error(`Visual capture integration audit failed:\n${errors.join('\n')}`);
}

console.log('Visual capture integration audit OK: read-only strict capture with 14 approved baseline evidence files');
