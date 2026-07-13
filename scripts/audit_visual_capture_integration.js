const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const WORKFLOW_PATH = '.github/workflows/visual-capture.yml';
const CAPTURE_PATH = 'scripts/capture_visual_baseline.js';
const MATRIX_PATH = 'data/css_regression_matrix.csv';
const DOC_PATH = 'docs/VISUAL-CAPTURE.md';
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
const matrixText = read(MATRIX_PATH);
const documentation = read(DOC_PATH);

requireTokens(workflow, [
  'name: Capture visual evidence',
  'contents: read',
  "VISUAL_CAPTURE_ENFORCE_QUALITY: 'false'",
  'node --check scripts/capture_visual_baseline.js',
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
  if (workflow.includes(token)) errors.push(`capture-only workflow must not contain ${token}`);
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

requireTokens(documentation, [
  'не изменяет CSS',
  'не объявляет снимки утверждённым baseline',
  'contents: read',
  '14 из 14 PNG',
  'отдельным небольшим PR'
], 'visual capture documentation');

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
    if (!/^css-reg-\d{3}$/.test(id)) errors.push(`matrix row ${index + 2}: invalid case_id ${id}`);
    if (ids.has(id)) errors.push(`matrix row ${index + 2}: duplicate case_id ${id}`);
    ids.add(id);
    if (status !== 'baseline_required') errors.push(`matrix row ${index + 2}: status must remain baseline_required in capture-only package`);
    if (evidence) errors.push(`matrix row ${index + 2}: evidence_ref must remain empty before review`);
  });
}

if (errors.length) {
  throw new Error(`Visual capture integration audit failed:\n${errors.join('\n')}`);
}

console.log('Visual capture integration audit OK: capture-only, read-only, detailed overflow diagnostics, 14 baseline_required cases');
