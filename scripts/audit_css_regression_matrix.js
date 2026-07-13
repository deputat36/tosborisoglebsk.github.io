const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const PAGE_PATH = path.join(ROOT, 'css-maintenance', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'CSS-MAINTENANCE.md');
const EVIDENCE_GUIDE_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'README.md');
const EVIDENCE_MANIFEST_PATH = path.join(ROOT, 'docs', 'visual-baseline', 'manifest.json');
const CAPTURE_DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-BASELINE-CAPTURE.md');
const CAPTURE_SCRIPT_PATH = path.join(ROOT, 'scripts', 'capture_visual_baseline.js');
const CAPTURE_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');

const expectedHeaders = [
  'case_id',
  'area',
  'route',
  'viewport_width',
  'viewport_height',
  'theme',
  'interaction',
  'mode',
  'expected_check',
  'status',
  'evidence_ref',
  'notes'
];

const allowedThemes = new Set(['light', 'dark']);
const allowedInteractions = new Set(['none', 'toggle-theme', 'open-menu', 'print-preview']);
const allowedModes = new Set(['screen', 'print']);
const allowedStatuses = new Set(['baseline_required', 'baseline_captured', 'passed', 'failed', 'blocked']);
const requiredWidths = new Set([360, 620, 900, 1180]);
const requiredRoutes = new Set([
  '/',
  '/tos/',
  '/tos/mirolyubie/',
  '/news/',
  '/news/vk-community-channel-2026/',
  '/workbench/',
  '/site-health/',
  '/workbench-routes/',
  '/field-checklist/'
]);

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function isHttpUrl(value) {
  return /^https:\/\//i.test(value || '');
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function requireTextTokens(text, tokens, errors, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must reference ${token}`);
  });
}

function validateEvidenceRef(status, evidenceRef, notes, errors, line) {
  const requiresEvidence = ['baseline_captured', 'passed', 'failed'].includes(status);

  if (status === 'baseline_required' && evidenceRef) {
    errors.push(`${line}: baseline_required must not contain evidence_ref`);
  }

  if (requiresEvidence && !evidenceRef) {
    errors.push(`${line}: ${status} requires evidence_ref`);
  }

  if (evidenceRef && !isHttpUrl(evidenceRef)) {
    if (!evidenceRef.startsWith('docs/visual-baseline/')) {
      errors.push(`${line}: local evidence_ref must be stored under docs/visual-baseline/`);
    }
    if (!repoPathExists(evidenceRef)) {
      errors.push(`${line}: local evidence_ref does not exist ${evidenceRef}`);
    }
  }

  if (['failed', 'blocked'].includes(status) && !notes) {
    errors.push(`${line}: ${status} requires notes with the observed problem or blocking reason`);
  }
}

function validateManifest(manifest, rowCount, errors) {
  if (!Number.isInteger(manifest.schema_version) || manifest.schema_version < 3) {
    errors.push('visual baseline manifest schema_version must be at least 3');
  }
  if (manifest.cases_total !== rowCount || manifest.cases_captured !== rowCount) {
    errors.push(`visual baseline manifest must contain ${rowCount}/${rowCount} cases`);
  }
  if (!Array.isArray(manifest.failures) || manifest.failures.length) {
    errors.push('visual baseline manifest must have an empty failures array');
  }
  if (!Array.isArray(manifest.quality_failures) || manifest.quality_failures.length) {
    errors.push('visual baseline manifest must have an empty quality_failures array');
  }
  if (!Array.isArray(manifest.results) || manifest.results.length !== rowCount) {
    errors.push(`visual baseline manifest results must contain ${rowCount} entries`);
  }
}

function validateEvidenceAgainstManifest(item, manifestItem, errors, line) {
  const {
    caseId,
    route,
    viewportWidth,
    viewportHeight,
    theme,
    interaction,
    mode,
    evidenceRef
  } = item;

  if (!manifestItem) {
    errors.push(`${line}: missing manifest result for ${caseId}`);
    return;
  }

  const evidencePath = path.join(ROOT, evidenceRef);
  const evidenceName = path.basename(evidenceRef);

  if (manifestItem.screenshot !== evidenceName) {
    errors.push(`${line}: manifest screenshot ${manifestItem.screenshot} does not match ${evidenceName}`);
  }
  if (manifestItem.sha256 !== sha256(evidencePath)) {
    errors.push(`${line}: evidence SHA-256 does not match manifest for ${caseId}`);
  }
  if (manifestItem.route !== route) errors.push(`${line}: manifest route mismatch for ${caseId}`);
  if (manifestItem.theme !== theme) errors.push(`${line}: manifest theme mismatch for ${caseId}`);
  if (manifestItem.interaction !== interaction) errors.push(`${line}: manifest interaction mismatch for ${caseId}`);
  if (manifestItem.mode !== mode) errors.push(`${line}: manifest mode mismatch for ${caseId}`);
  if (manifestItem.viewport?.width !== viewportWidth || manifestItem.viewport?.height !== viewportHeight) {
    errors.push(`${line}: manifest viewport mismatch for ${caseId}`);
  }
  if (!Array.isArray(manifestItem.technical_violations) || manifestItem.technical_violations.length) {
    errors.push(`${line}: manifest technical_violations must be empty for ${caseId}`);
  }
  if (manifestItem.diagnostics?.horizontalOverflow) {
    errors.push(`${line}: manifest reports horizontal overflow for ${caseId}`);
  }
  if (manifestItem.diagnostics?.htmlTheme !== theme) {
    errors.push(`${line}: manifest rendered theme mismatch for ${caseId}`);
  }
  if (interaction === 'open-menu') {
    if (!manifestItem.diagnostics?.menuOpen || manifestItem.diagnostics?.menuExpanded !== 'true') {
      errors.push(`${line}: manifest mobile menu state is invalid for ${caseId}`);
    }
  }
  if ((manifestItem.console_errors || []).length) errors.push(`${line}: manifest contains console errors for ${caseId}`);
  if ((manifestItem.page_errors || []).length) errors.push(`${line}: manifest contains page errors for ${caseId}`);
  if ((manifestItem.failed_requests || []).length) errors.push(`${line}: manifest contains failed requests for ${caseId}`);
}

function main() {
  const errors = [];

  [
    MATRIX_PATH,
    PAGE_PATH,
    DOC_PATH,
    EVIDENCE_GUIDE_PATH,
    EVIDENCE_MANIFEST_PATH,
    CAPTURE_DOC_PATH,
    CAPTURE_SCRIPT_PATH,
    CAPTURE_WORKFLOW_PATH
  ].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });

  if (errors.length) throw new Error(`CSS regression matrix audit failed:\n${errors.join('\n')}`);

  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
  const docText = fs.readFileSync(DOC_PATH, 'utf8');
  const evidenceGuide = fs.readFileSync(EVIDENCE_GUIDE_PATH, 'utf8');
  const evidenceManifest = JSON.parse(fs.readFileSync(EVIDENCE_MANIFEST_PATH, 'utf8'));
  const captureDoc = fs.readFileSync(CAPTURE_DOC_PATH, 'utf8');
  const captureScript = fs.readFileSync(CAPTURE_SCRIPT_PATH, 'utf8');
  const captureWorkflow = fs.readFileSync(CAPTURE_WORKFLOW_PATH, 'utf8');
  const headers = (rows[0] || []).map(normalize);
  const rowCount = Math.max(0, rows.length - 1);

  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  if (rows.length < 11) errors.push('matrix must contain at least 10 control cases');
  validateManifest(evidenceManifest, rowCount, errors);

  const manifestById = new Map((evidenceManifest.results || []).map((item) => [item.case_id, item]));
  const seenIds = new Set();
  const seenRoutes = new Set();
  const seenWidths = new Set();
  const seenThemes = new Set();
  const seenModes = new Set();
  let mobileMenuCases = 0;
  let printCases = 0;

  rows.slice(1).forEach((row, index) => {
    const line = `CSS regression row ${index + 2}`;
    const values = expectedHeaders.map((_, columnIndex) => normalize(row[columnIndex]));
    const [
      caseId,
      area,
      route,
      viewportWidthRaw,
      viewportHeightRaw,
      theme,
      interaction,
      mode,
      expectedCheck,
      status,
      evidenceRef,
      notes
    ] = values;

    const viewportWidth = Number(viewportWidthRaw);
    const viewportHeight = Number(viewportHeightRaw);

    if (!/^css-reg-\d{3}$/.test(caseId)) errors.push(`${line}: invalid case_id ${caseId}`);
    if (seenIds.has(caseId)) errors.push(`${line}: duplicate case_id ${caseId}`);
    if (caseId) seenIds.add(caseId);
    if (!area) errors.push(`${line}: missing area`);
    if (!route || !route.startsWith('/')) errors.push(`${line}: invalid route ${route}`);
    if (route && !repoPathExists(route)) errors.push(`${line}: route does not exist ${route}`);
    if (route) seenRoutes.add(route);

    if (!Number.isInteger(viewportWidth) || viewportWidth < 320 || viewportWidth > 2000) {
      errors.push(`${line}: invalid viewport_width ${viewportWidthRaw}`);
    } else {
      seenWidths.add(viewportWidth);
    }

    if (!Number.isInteger(viewportHeight) || viewportHeight < 600 || viewportHeight > 2000) {
      errors.push(`${line}: invalid viewport_height ${viewportHeightRaw}`);
    }

    if (!allowedThemes.has(theme)) errors.push(`${line}: unsupported theme ${theme}`);
    if (theme) seenThemes.add(theme);
    if (!allowedInteractions.has(interaction)) errors.push(`${line}: unsupported interaction ${interaction}`);
    if (!allowedModes.has(mode)) errors.push(`${line}: unsupported mode ${mode}`);
    if (mode) seenModes.add(mode);
    if (!expectedCheck) errors.push(`${line}: missing expected_check`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);

    validateEvidenceRef(status, evidenceRef, notes, errors, line);

    if (['baseline_captured', 'passed'].includes(status) && evidenceRef && !isHttpUrl(evidenceRef) && fs.existsSync(path.join(ROOT, evidenceRef))) {
      validateEvidenceAgainstManifest({
        caseId,
        route,
        viewportWidth,
        viewportHeight,
        theme,
        interaction,
        mode,
        evidenceRef
      }, manifestById.get(caseId), errors, line);
    }

    if (interaction === 'open-menu') {
      mobileMenuCases += 1;
      if (viewportWidth > 620) errors.push(`${line}: open-menu case must use viewport_width <= 620`);
      if (mode !== 'screen') errors.push(`${line}: open-menu case must use screen mode`);
    }

    if (mode === 'print' || interaction === 'print-preview') {
      printCases += 1;
      if (mode !== 'print' || interaction !== 'print-preview') {
        errors.push(`${line}: print case must combine mode=print and interaction=print-preview`);
      }
    }

    if (mode === 'print' && theme !== 'light') errors.push(`${line}: print case must use light theme`);
  });

  requiredRoutes.forEach((route) => {
    if (!seenRoutes.has(route)) errors.push(`missing required control route ${route}`);
  });
  requiredWidths.forEach((width) => {
    if (!seenWidths.has(width)) errors.push(`missing required viewport width ${width}`);
  });
  allowedThemes.forEach((theme) => {
    if (!seenThemes.has(theme)) errors.push(`missing required theme ${theme}`);
  });
  allowedModes.forEach((mode) => {
    if (!seenModes.has(mode)) errors.push(`missing required mode ${mode}`);
  });
  if (mobileMenuCases < 1) errors.push('matrix must contain a mobile menu case');
  if (printCases < 1) errors.push('matrix must contain a print preview case');

  if (!pageHtml.includes('/data/css_regression_matrix.csv')) {
    errors.push('css-maintenance page must link to /data/css_regression_matrix.csv');
  }
  if (!docText.includes('data/css_regression_matrix.csv')) {
    errors.push('CSS maintenance documentation must reference data/css_regression_matrix.csv');
  }
  if (!docText.includes('docs/visual-baseline/README.md')) {
    errors.push('CSS maintenance documentation must reference docs/visual-baseline/README.md');
  }
  if (!evidenceGuide.includes('data/css_regression_matrix.csv')) {
    errors.push('visual baseline evidence guide must reference data/css_regression_matrix.csv');
  }

  requireTextTokens(captureScript, [
    "require('playwright')",
    'data/css_regression_matrix.csv',
    'manifest.json',
    'sha256',
    'horizontalOverflow',
    'failed_requests'
  ], errors, 'visual baseline capture script');

  requireTextTokens(captureWorkflow, [
    'node scripts/capture_visual_baseline.js',
    'python3 -m http.server 4173',
    'actions/upload-artifact@v4',
    'retention-days: 30',
    'contents: read'
  ], errors, 'visual baseline workflow');

  requireTextTokens(captureDoc, [
    '.github/workflows/visual-baseline.yml',
    'scripts/capture_visual_baseline.js',
    'data/css_regression_matrix.csv',
    'manifest.json',
    'baseline_captured'
  ], errors, 'visual baseline capture documentation');

  if (errors.length) {
    throw new Error(`CSS regression matrix audit failed:\n${errors.join('\n')}`);
  }

  console.log(`CSS regression matrix OK: ${rowCount} cases, ${seenRoutes.size} routes, ${seenWidths.size} viewport widths, durable evidence verified`);
}

main();
