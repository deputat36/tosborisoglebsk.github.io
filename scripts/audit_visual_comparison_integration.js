const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COMPARATOR_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const REPORT_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'COMPARISON-2026-07-13.md');
const CAPTURE_DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-BASELINE-CAPTURE.md');

function requireTokens(text, tokens, errors, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must reference ${token}`);
  });
}

function main() {
  const errors = [];
  [COMPARATOR_PATH, WORKFLOW_PATH, REPORT_PATH, CAPTURE_DOC_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });

  if (errors.length) throw new Error(`Visual comparison integration audit failed:\n${errors.join('\n')}`);

  const comparator = fs.readFileSync(COMPARATOR_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const captureDoc = fs.readFileSync(CAPTURE_DOC_PATH, 'utf8');

  requireTokens(comparator, [
    "require('pngjs')",
    'docs/visual-baseline',
    'comparison.json',
    'pixel_identical',
    'pixel_equivalent',
    'significant_changed_pixels',
    'VISUAL_MAX_CHANNEL_DELTA',
    'VISUAL_MAX_LOW_DELTA_RATIO',
    'Visual regression detected'
  ], errors, 'visual comparator');

  requireTokens(workflow, [
    'pngjs@7.0.0',
    'node scripts/compare_visual_baseline.js',
    'Compare with approved visual baseline',
    'VISUAL_BASELINE_APPROVED: docs/visual-baseline',
    "VISUAL_MAX_CHANNEL_DELTA: '16'",
    "VISUAL_MAX_LOW_DELTA_RATIO: '0.005'",
    'contents: read'
  ], errors, 'visual baseline workflow');

  requireTokens(report, [
    '29262442927',
    '29262907242',
    'пиксельно идентичны: 14 из 14',
    'изменённых пикселей: 0'
  ], errors, 'visual comparison report');

  requireTokens(captureDoc, [
    'scripts/compare_visual_baseline.js',
    'comparison.json',
    'pixel_equivalent',
    'max_channel_delta',
    'max_low_delta_ratio'
  ], errors, 'visual capture documentation');

  if (errors.length) {
    throw new Error(`Visual comparison integration audit failed:\n${errors.join('\n')}`);
  }

  console.log('Visual comparison integration OK');
}

main();
