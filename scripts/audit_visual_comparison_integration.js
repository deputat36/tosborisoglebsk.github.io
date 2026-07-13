const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COMPARATOR_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-capture.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-CAPTURE.md');
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
  '16 уровней канала'
], 'visual capture documentation');

if (errors.length) {
  throw new Error(`Visual comparison integration audit failed:\n${errors.join('\n')}`);
}

console.log('Visual comparison integration audit OK: RGBA comparator and bounded thresholds are enforced');
