const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const COMPARATOR_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-capture.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-CAPTURE.md');
const REPORT_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'COMPARISON-2026-07-13.md');
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const errors = [];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing visual comparison file ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

const comparator = read(COMPARATOR_PATH);
const workflow = read(WORKFLOW_PATH);
const documentation = read(DOC_PATH);
const report = read(REPORT_PATH);
const matrixText = read(MATRIX_PATH);

requireTokens(comparator, [
  "require('pngjs')",
  'docs/visual-baseline',
  'comparison.json',
  'comparison.md',
  'pixel_identical',
  'pixel_equivalent',
  'significant_changed_pixels',
  'metadata_mismatches',
  'VISUAL_MAX_CHANNEL_DELTA',
  'VISUAL_MAX_LOW_DELTA_RATIO',
  'DEFAULT_MAX_CHANNEL_DELTA = 16',
  'DEFAULT_MAX_LOW_DELTA_RATIO = 0.005',
  'HARD_MAX_CHANNEL_DELTA = 32',
  'HARD_MAX_LOW_DELTA_RATIO = 0.01',
  'missing_current_cases',
  'unexpected_current_cases',
  'Visual regression detected'
], 'visual comparator');

requireTokens(workflow, [
  'pngjs@7.0.0',
  'node --check scripts/compare_visual_baseline.js',
  'node --check scripts/audit_visual_comparison_integration.js',
  'node scripts/audit_visual_comparison_integration.js',
  'node scripts/compare_visual_baseline.js',
  'Compare with approved visual baseline',
  'VISUAL_BASELINE_APPROVED: docs/visual-baseline',
  "VISUAL_MAX_CHANNEL_DELTA: '16'",
  "VISUAL_MAX_LOW_DELTA_RATIO: '0.005'",
  'contents: read'
], 'visual capture workflow');

[
  "VISUAL_MAX_CHANNEL_DELTA: '33'",
  "VISUAL_MAX_LOW_DELTA_RATIO: '0.011'",
  'contents: write',
  'git push'
].forEach((token) => {
  if (workflow.includes(token)) errors.push(`visual comparator workflow must not contain ${token}`);
});

requireTokens(documentation, [
  'scripts/compare_visual_baseline.js',
  'comparison.json',
  'pixel_equivalent',
  'max_channel_delta',
  'max_low_delta_ratio',
  '0,5%',
  '16 уровней канала',
  'Все 14 строк',
  'статус `passed`'
], 'visual capture documentation');

requireTokens(report, [
  'Comparator run: `29277336532`',
  'pixel_identical: 14',
  'pixel_equivalent: 14',
  'bytes_identical: 14',
  'changed cases: 0',
  'missing current cases: 0',
  'unexpected current cases: 0',
  'Статус `passed` означает'
], 'visual comparison report');

if (matrixText) {
  const rows = parseCsv(matrixText);
  if (rows.length !== 15) errors.push(`visual matrix must contain 14 rows, found ${Math.max(0, rows.length - 1)}`);
  rows.slice(1).forEach((row, index) => {
    const id = String(row[0] || '').trim();
    const status = String(row[9] || '').trim();
    const evidence = String(row[10] || '').trim();
    const notes = String(row[11] || '').trim();
    if (status !== 'passed') errors.push(`matrix row ${index + 2}: status must be passed`);
    if (evidence !== `docs/visual-baseline/${id}.png`) errors.push(`matrix row ${index + 2}: invalid evidence_ref`);
    if (!notes.includes('pixel_identical=true') || !notes.includes('pixel_equivalent=true')) {
      errors.push(`matrix row ${index + 2}: successful comparator result is missing`);
    }
  });
}

if (errors.length) {
  throw new Error(`Visual comparison integration audit failed:\n${errors.join('\n')}`);
}

console.log('Visual comparison integration audit OK: 14 passed cases, RGBA comparator and bounded thresholds are enforced');
