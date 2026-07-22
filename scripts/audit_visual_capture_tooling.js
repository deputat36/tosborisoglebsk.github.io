const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const CAPTURE_PATH = path.join(ROOT, 'scripts', 'capture_visual_baseline.js');
const COMPARE_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const MANIFEST_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_visual_capture_manifest.js');
const OVERFLOW_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_visual_overflow_fixes.js');
const RESPONSIVE_PATCH_PATH = path.join(ROOT, 'scripts', 'patch_tos_detail_responsive_styles.js');
const FOCUS_PATCH_PATH = path.join(ROOT, 'scripts', 'patch_visual_focus_capture.js');
const EXTENSION_PATCH_PATH = path.join(ROOT, 'scripts', 'patch_visual_baseline_extensions.js');
const DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-BASELINE-CAPTURE.md');
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const APPROVED_MANIFEST_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'manifest.json');
const FOCUS_MANIFEST_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'manifest-focus.json');

const REQUIRED_MATRIX_HEADERS = [
  'case_id', 'area', 'route', 'viewport_width', 'viewport_height', 'theme',
  'interaction', 'mode', 'expected_check', 'status', 'evidence_ref', 'notes'
];

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label} missing ${fragment}`);
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function auditFocusBaseline(errors, expectedFocusIds) {
  if (!fs.existsSync(FOCUS_MANIFEST_PATH)) {
    errors.push(`missing file ${path.relative(ROOT, FOCUS_MANIFEST_PATH)}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(FOCUS_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    errors.push(`invalid focus manifest JSON: ${error.message}`);
    return;
  }

  if (manifest.schema_version !== 1) errors.push(`focus manifest schema must be 1, received ${manifest.schema_version}`);
  if (manifest.base_manifest !== 'manifest.json') errors.push('focus manifest must extend manifest.json');
  const results = Array.isArray(manifest.results) ? manifest.results : [];
  const ids = results.map((item) => item.case_id);
  expectedFocusIds.forEach((id) => {
    if (!ids.includes(id)) errors.push(`focus manifest is missing ${id}`);
  });
  ids.forEach((id) => {
    if (!expectedFocusIds.includes(id)) errors.push(`focus manifest contains unexpected ${id}`);
  });
  if (new Set(ids).size !== ids.length) errors.push('focus manifest case IDs must be unique');

  results.forEach((item) => {
    const label = item.case_id || 'focus baseline result';
    const fingerprint = item.visual_fingerprint || {};
    if (fingerprint.scheme !== 'rgb-grid-v1') errors.push(`${label}: unsupported fingerprint scheme ${fingerprint.scheme}`);
    const columns = Number(fingerprint.columns);
    const rows = Number(fingerprint.rows);
    if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
      errors.push(`${label}: invalid fingerprint grid`);
      return;
    }
    const decoded = Buffer.from(String(fingerprint.data_base64 || ''), 'base64');
    if (decoded.length !== columns * rows * 3) errors.push(`${label}: fingerprint byte length is invalid`);
    if (fingerprint.sha256 && sha256(decoded) !== fingerprint.sha256) errors.push(`${label}: fingerprint SHA-256 does not match`);
    if (!/^[a-f0-9]{64}$/.test(String(item.screenshot_sha256 || ''))) errors.push(`${label}: screenshot_sha256 is invalid`);
    if (!Number.isInteger(Number(item.bytes)) || Number(item.bytes) < 1) errors.push(`${label}: screenshot byte size is invalid`);
    if (Number(item.viewport?.width) < 1 || Number(item.viewport?.height) < 1) errors.push(`${label}: viewport is invalid`);
  });
}

function main() {
  const errors = [];
  const requiredFiles = [
    WORKFLOW_PATH, CAPTURE_PATH, COMPARE_PATH, MANIFEST_AUDIT_PATH, OVERFLOW_AUDIT_PATH,
    RESPONSIVE_PATCH_PATH, FOCUS_PATCH_PATH, EXTENSION_PATCH_PATH, DOC_PATH, MATRIX_PATH
  ];
  requiredFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Visual capture tooling audit failed:\n${errors.join('\n')}`);

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const capture = fs.readFileSync(CAPTURE_PATH, 'utf8');
  const compare = fs.readFileSync(COMPARE_PATH, 'utf8');
  const manifestAudit = fs.readFileSync(MANIFEST_AUDIT_PATH, 'utf8');
  const doc = fs.readFileSync(DOC_PATH, 'utf8');
  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map(normalize);
  const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalize(row[index])])));

  if (headers.join('|') !== REQUIRED_MATRIX_HEADERS.join('|')) errors.push(`unexpected matrix headers: ${headers.join(', ')}`);
  if (records.length !== 16) errors.push(`matrix must contain 16 cases, received ${records.length}`);
  if (new Set(records.map((item) => item.case_id)).size !== records.length) errors.push('matrix case_id values must be unique');

  const focusRecords = records.filter((item) => item.interaction.startsWith('focus-'));
  const focusInteractions = new Set(focusRecords.map((item) => item.interaction));
  ['focus-catalog', 'focus-places'].forEach((interaction) => {
    if (!focusInteractions.has(interaction)) errors.push(`matrix is missing ${interaction}`);
  });

  requireFragments(errors, 'visual workflow', workflow, [
    'workflow_dispatch:', 'pull_request:', 'contents: read', "node-version: '24'",
    'node scripts/patch_tos_detail_responsive_styles.js', 'Check patched visual capture syntax',
    'Check patched visual comparator syntax', 'node scripts/audit_visual_overflow_fixes.js',
    'continue-on-error: true', "VISUAL_CAPTURE_STRICT_QUALITY: 'false'",
    "VISUAL_CAPTURE_STRICT_QUALITY: 'true'", 'Audit capture manifest in measurement mode',
    'Audit capture manifest in strict mode', 'Detect approved baseline',
    'node scripts/compare_visual_baseline.js', 'actions/upload-artifact@v4', 'retention-days: 30'
  ]);
  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('visual workflow must be read-only and must not commit or push');
  }
  if (!workflow.includes("steps.approved.outputs.available == 'true'")) errors.push('visual comparison and strict audit must be gated by approved baseline');

  requireFragments(errors, 'capture script', capture, [
    "require('playwright')", 'data/css_regression_matrix.csv', 'FOCUS_TARGETS',
    'positionPageForCapture', 'focus_capture', 'ready_count', 'header_offset',
    'technical_violations', 'failed_requests', 'manifest.json', 'schema_version: 3'
  ]);
  requireFragments(errors, 'comparison script', compare, [
    "require('pngjs')", 'BASELINE_EXTENSION_PATH', 'readApprovedManifest',
    'compareVisualFingerprint', 'buildRgbGrid', 'visual_fingerprint', 'rgb-grid-v1',
    'VISUAL_MAX_CHANNEL_DELTA', 'VISUAL_MAX_LOW_DELTA_RATIO', 'pixel_equivalent',
    'significant_changed_pixels', 'comparison.json'
  ]);
  requireFragments(errors, 'capture manifest audit', manifestAudit, [
    'VISUAL_CAPTURE_STRICT_QUALITY', "STRICT_QUALITY ? 'strict' : 'measurement'",
    'focus_capture', 'ready_count', 'header_offset', 'qualityFindings',
    'failed requests are present', 'horizontal overflow is present',
    'sha256 does not match screenshot',
    'Quality findings are recorded but do not block until an approved baseline exists.'
  ]);
  requireFragments(errors, 'visual capture documentation', doc, [
    'baseline_required', 'GitHub Actions artifact', 'не коммитит', 'compare_approved',
    'измерительный режим', 'строгий режим', 'manifest-focus.json', 'rgb-grid-v1',
    'focus-catalog', 'focus-places', 'отдельный визуальный review'
  ]);

  const approvedExists = fs.existsSync(APPROVED_MANIFEST_PATH);
  if (!approvedExists) {
    records.forEach((item) => {
      if (item.status !== 'baseline_required') errors.push(`${item.case_id}: status must remain baseline_required before approved manifest exists`);
      if (item.evidence_ref) errors.push(`${item.case_id}: evidence_ref must be empty before approved manifest exists`);
    });
  } else {
    const allowedApprovedStatuses = new Set(['baseline_captured', 'passed', 'failed']);
    records.forEach((item) => {
      if (!allowedApprovedStatuses.has(item.status)) errors.push(`${item.case_id}: unsupported approved-baseline status ${item.status}`);
      if (!item.evidence_ref) errors.push(`${item.case_id}: evidence_ref is required when approved manifest exists`);
    });
    auditFocusBaseline(errors, focusRecords.map((item) => item.case_id));
  }

  if (errors.length) throw new Error(`Visual capture tooling audit failed:\n${errors.join('\n')}`);

  execFileSync(process.execPath, [OVERFLOW_AUDIT_PATH], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Visual capture tooling OK: ${records.length} cases, ${focusInteractions.size} focused interactions, approved baseline ${approvedExists ? 'present' : 'not yet present'}, workflow read-only`);
}

main();
