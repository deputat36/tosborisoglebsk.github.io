const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const PAGE_PATH = path.join(ROOT, 'css-maintenance', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'CSS-MAINTENANCE.md');

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
const allowedInteractions = new Set([
  'none',
  'toggle-theme',
  'open-menu',
  'print-preview',
  'focus-catalog',
  'focus-places'
]);
const allowedModes = new Set(['screen', 'print']);
const allowedStatuses = new Set(['baseline_required', 'baseline_captured', 'passed', 'failed', 'blocked']);
const requiredWidths = new Set([360, 620, 900, 1180]);
const requiredRoutes = new Set([
  '/',
  '/tos/',
  '/tos/mirolyubie/',
  '/places/',
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

function main() {
  const errors = [];

  [MATRIX_PATH, PAGE_PATH, DOC_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });

  if (errors.length) throw new Error(`CSS regression matrix audit failed:\n${errors.join('\n')}`);

  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
  const docText = fs.readFileSync(DOC_PATH, 'utf8');
  const headers = (rows[0] || []).map(normalize);

  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  if (rows.length < 11) errors.push('matrix must contain at least 10 control cases');

  const seenIds = new Set();
  const seenRoutes = new Set();
  const seenWidths = new Set();
  const seenThemes = new Set();
  const seenModes = new Set();
  let mobileMenuCases = 0;
  let printCases = 0;
  let focusedDynamicCases = 0;

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
      evidenceRef
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

    if (['baseline_captured', 'passed', 'failed'].includes(status) && !evidenceRef) {
      errors.push(`${line}: ${status} requires evidence_ref`);
    }

    if (interaction === 'open-menu') {
      mobileMenuCases += 1;
      if (viewportWidth > 620) errors.push(`${line}: open-menu case must use viewport_width <= 620`);
      if (mode !== 'screen') errors.push(`${line}: open-menu case must use screen mode`);
    }

    if (interaction.startsWith('focus-')) {
      focusedDynamicCases += 1;
      if (mode !== 'screen') errors.push(`${line}: focused dynamic case must use screen mode`);
      if (viewportWidth > 620) errors.push(`${line}: focused dynamic case must verify compact layout at viewport_width <= 620`);
      if (viewportHeight < 1000) errors.push(`${line}: focused dynamic case must provide enough height for controls and cards`);
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
  if (focusedDynamicCases < 2) errors.push('matrix must contain focused cases for both dynamic catalogs');

  if (!pageHtml.includes('/data/css_regression_matrix.csv')) {
    errors.push('css-maintenance page must link to /data/css_regression_matrix.csv');
  }
  if (!docText.includes('data/css_regression_matrix.csv')) {
    errors.push('CSS maintenance documentation must reference data/css_regression_matrix.csv');
  }

  if (errors.length) {
    throw new Error(`CSS regression matrix audit failed:\n${errors.join('\n')}`);
  }

  console.log(`CSS regression matrix OK: ${rows.length - 1} cases, ${seenRoutes.size} routes, ${seenWidths.size} viewport widths, ${focusedDynamicCases} focused dynamic cases`);
}

main();
