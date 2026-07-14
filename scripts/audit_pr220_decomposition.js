const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { HEADERS, buildRows, renderCsv, OUTPUT_PATH } = require('./generate_pr220_decomposition_inventory');

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'pr220_changed_paths.json');
const DOC_PATH = path.join(ROOT, 'docs', 'PR220-DECOMPOSITION-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'pr220-decomposition-audit.yml');

const REQUIRED_PROTECTED = new Set([
  '.github/workflows/generate-tos-pages.yml',
  'package.json',
  'scripts/audit_project_mode.js',
  'scripts/audit_project_mode_full.js',
  'scripts/audit_seo.js',
  'scripts/audit_site_links.js',
  'scripts/generate_project_pages.js'
]);

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function rowsFromCsv(text) {
  const matrix = parseCsv(text);
  if (!matrix.length) return [];
  const headers = matrix[0];
  return matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function sortedObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right))
  );
}

function main() {
  const errors = [];
  const source = JSON.parse(read(SOURCE_PATH));
  const expectedRows = buildRows(source);
  const expectedCsv = renderCsv(expectedRows);
  const actualCsv = read(OUTPUT_PATH);
  const actualRows = rowsFromCsv(actualCsv);

  if (actualCsv !== expectedCsv) errors.push('PR 220 decomposition CSV is stale or was edited manually');
  if (source.schema_version !== 1) errors.push('source snapshot schema_version must be 1');
  if (source.source_pr !== 220) errors.push('source_pr must be 220');
  if (source.source_pr_state !== 'closed_unmerged') errors.push('PR 220 must remain classified as closed_unmerged');
  if (source.ahead_by !== 88 || source.behind_by !== 14) errors.push('divergence metadata must remain 88 ahead / 14 behind');
  if (source.changed_files !== 99) errors.push('source snapshot must contain 99 changed files');
  if (source.direct_merge_allowed !== false) errors.push('direct merge must remain prohibited');
  if (source.direct_cherry_pick_allowed !== false) errors.push('direct cherry-pick must remain prohibited');
  if (!Array.isArray(source.paths) || source.paths.length !== 99) errors.push('source paths must contain exactly 99 entries');
  if (new Set(source.paths || []).size !== 99) errors.push('source paths must be unique');

  if (actualRows.length !== 99) errors.push(`inventory must contain 99 rows, found ${actualRows.length}`);
  const actualHeaders = actualCsv.split(/\r?\n/, 1)[0].split(',');
  if (JSON.stringify(actualHeaders) !== JSON.stringify(HEADERS)) errors.push('inventory headers do not match the contract');

  const pathSet = new Set();
  const categoryCounts = {};
  for (const row of actualRows) {
    if (!row.path) errors.push('inventory row is missing path');
    if (pathSet.has(row.path)) errors.push(`duplicate inventory path: ${row.path}`);
    pathSet.add(row.path);
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;

    if (row.direct_cherry_pick_allowed !== 'false') errors.push(`${row.path}: direct cherry-pick must be false`);
    if (!['true', 'false'].includes(row.conflicts_with_current_main)) errors.push(`${row.path}: invalid conflict flag`);
    if (!['medium', 'high', 'critical'].includes(row.risk)) errors.push(`${row.path}: invalid risk ${row.risk}`);
    if (!row.decision || !row.reason) errors.push(`${row.path}: decision and reason are required`);
  }

  for (const filePath of source.paths || []) {
    if (!pathSet.has(filePath)) errors.push(`missing inventory path: ${filePath}`);
  }
  for (const filePath of pathSet) {
    if (!(source.paths || []).includes(filePath)) errors.push(`unexpected inventory path: ${filePath}`);
  }

  const normalizedActualCounts = sortedObject(categoryCounts);
  const normalizedExpectedCounts = sortedObject(source.category_counts || {});
  if (JSON.stringify(normalizedActualCounts) !== JSON.stringify(normalizedExpectedCounts)) {
    errors.push(`category counts differ: ${JSON.stringify(normalizedActualCounts)} != ${JSON.stringify(normalizedExpectedCounts)}`);
  }

  for (const filePath of REQUIRED_PROTECTED) {
    const row = actualRows.find((item) => item.path === filePath);
    if (!row || row.category !== 'protected_shared_core' || row.decision !== 'do_not_cherry_pick' || row.risk !== 'critical') {
      errors.push(`${filePath}: protected core classification is invalid`);
    }
  }

  const cssRows = actualRows.filter((row) => row.category === 'css_source_superseded');
  if (!cssRows.length || cssRows.some((row) => row.replacement_or_evidence !== '#255')) {
    errors.push('CSS superseded rows must reference PR #255');
  }
  const adminRows = actualRows.filter((row) => ['admin_surface_superseded', 'admin_feature_candidate'].includes(row.category));
  if (!adminRows.length || adminRows.some((row) => row.replacement_or_evidence !== '#256')) {
    errors.push('Admin rows must reference PR #256');
  }

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  if (scripts['report:pr220-decomposition'] !== 'node scripts/generate_pr220_decomposition_inventory.js') {
    errors.push('package.json must define report:pr220-decomposition');
  }
  if (scripts['audit:pr220-decomposition'] !== 'node scripts/audit_pr220_decomposition.js') {
    errors.push('package.json must define audit:pr220-decomposition');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run report:pr220-decomposition && npm run audit:pr220-decomposition')) {
    errors.push('audit:all must generate and audit PR 220 decomposition');
  }

  for (const [label, filePath] of [
    ['project-mode', PROJECT_MODE_PATH],
    ['project-mode-full', PROJECT_MODE_FULL_PATH]
  ]) {
    if (!read(filePath).includes('scripts/audit_pr220_decomposition.js')) errors.push(`${label} must include PR 220 decomposition audit`);
  }

  const workflow = read(WORKFLOW_PATH);
  for (const token of ['contents: read', 'Generate PR 220 decomposition inventory', 'Audit PR 220 decomposition', 'Run full project mode audits']) {
    if (!workflow.includes(token)) errors.push(`decomposition workflow is missing ${token}`);
  }
  if (/contents:\s*write/i.test(workflow)) errors.push('decomposition workflow must not request contents: write');
  if (/git-auto-commit|Commit PR 220 decomposition inventory/i.test(workflow)) errors.push('decomposition workflow must remain read-only');

  const doc = read(DOC_PATH);
  for (const token of [
    'Прямое слияние PR №220 запрещено',
    '88 коммитов впереди',
    '14 коммитов позади',
    '99 изменённых путей',
    'PR №255',
    'PR №256',
    'admin_feature_candidate',
    'small_candidate_requires_recheck'
  ]) {
    if (!doc.includes(token)) errors.push(`decomposition documentation is missing: ${token}`);
  }

  if (errors.length) throw new Error(`PR 220 decomposition audit failed:\n${Array.from(new Set(errors)).join('\n')}`);

  console.log(`PR 220 decomposition OK: ${actualRows.length} paths, direct merge and cherry-pick prohibited`);
}

main();
