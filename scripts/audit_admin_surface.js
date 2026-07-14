const fs = require('fs');
const path = require('path');
const { buildInventory, REPORT_PATH } = require('./generate_admin_surface_inventory');

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'admin-surface-audit.yml');
const MAIN_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'ADMIN-LOCAL-SECURITY-MODEL.md');

const REMOVED_LEGACY_FILES = [
  'admin/admin.js',
  'admin/admin-logo-bulk.js',
  'admin/admin-mass-autofill.js',
  'admin/admin-mass-fill-all.js',
  'admin/admin-mass-all-autofill.js'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stable(value) {
  return JSON.stringify(value);
}

function main() {
  const errors = [];
  const expected = buildInventory();
  const actual = JSON.parse(read(REPORT_PATH));

  if (stable(actual) !== stable(expected)) {
    errors.push('data/admin_surface_inventory.json is stale; regenerate it');
  }

  if (expected.security_model !== 'public_client_side_local_editor') errors.push('security_model must be public_client_side_local_editor');
  if (expected.server_authentication !== false) errors.push('server_authentication must remain false');
  if (expected.network_write_enabled !== false) errors.push('network_write_enabled must remain false');
  if (expected.private_data_allowed !== false) errors.push('private_data_allowed must remain false');

  const zeroMetrics = [
    'external_network_targets',
    'external_write_signals',
    'dangerous_execution_signals',
    'potential_secret_signals',
    'forbidden_backend_references',
    'missing_local_references',
    'javascript_syntax_failures',
    'unlinked_files'
  ];
  for (const metric of zeroMetrics) {
    if (expected.summary[metric] !== 0) errors.push(`${metric} must be 0, found ${expected.summary[metric]}`);
  }

  for (const [control, passed] of Object.entries(expected.controls)) {
    if (passed !== true) errors.push(`admin control failed: ${control}`);
  }

  const allowedTargets = new Set([
    '/data/toses.json',
    '/data/news.json',
    '/data/articles.json',
    '/data/documents.json',
    '/data/grants.json',
    '/data/projects.json',
    '/data/events.json',
    '/data/needs.json'
  ]);
  for (const target of expected.local_read_targets) {
    if (!allowedTargets.has(target)) errors.push(`unexpected local read target: ${target}`);
  }

  const activeEntry = expected.files.find((row) => row.path === 'admin/index.html');
  if (!activeEntry || activeEntry.role !== 'active_entry') errors.push('admin/index.html must be active_entry');
  const legacy = expected.files.find((row) => row.path === 'admin/admin-index-ready.html');
  if (!legacy || legacy.role !== 'legacy_redirect') errors.push('admin/admin-index-ready.html must be legacy_redirect');

  const expectedAssets = [
    'admin/admin.css',
    'admin/admin-dashboard.js',
    'admin/admin-logo-tools.js',
    'admin/admin2.js'
  ];
  for (const asset of expectedAssets) {
    const row = expected.files.find((item) => item.path === asset);
    if (!row || row.role !== 'active_asset') errors.push(`${asset} must be an active_asset`);
  }

  for (const legacyPath of REMOVED_LEGACY_FILES) {
    if (fs.existsSync(path.join(ROOT, legacyPath))) errors.push(`legacy file must remain removed: ${legacyPath}`);
  }

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  if (scripts['report:admin-surface'] !== 'node scripts/generate_admin_surface_inventory.js') {
    errors.push('package.json must define report:admin-surface');
  }
  if (scripts['audit:admin-surface'] !== 'node scripts/audit_admin_surface.js') {
    errors.push('package.json must define audit:admin-surface');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run report:admin-surface && npm run audit:admin-surface')) {
    errors.push('audit:all must generate and audit admin surface');
  }

  for (const [label, filePath] of [
    ['project-mode', PROJECT_MODE_PATH],
    ['project-mode-full', PROJECT_MODE_FULL_PATH]
  ]) {
    if (!read(filePath).includes('scripts/audit_admin_surface.js')) errors.push(`${label} must include admin surface audit`);
  }

  if (!read(MAIN_WORKFLOW_PATH).includes('Audit local admin surface')) errors.push('main workflow must audit local admin surface');
  const workflow = read(WORKFLOW_PATH);
  for (const token of ['contents: read', 'Generate admin surface inventory', 'Audit admin surface', 'Run full project mode audits']) {
    if (!workflow.includes(token)) errors.push(`admin workflow is missing ${token}`);
  }
  if (/contents:\s*write/i.test(workflow)) errors.push('admin workflow must not request contents: write');
  if (/git-auto-commit|Commit admin surface inventory/i.test(workflow)) errors.push('admin workflow must remain read-only');

  const doc = read(DOC_PATH);
  for (const token of [
    'публичный клиентский локальный редактор',
    'не является серверной авторизацией',
    'не допускаются закрытая переписка',
    'external network targets: 0',
    'write signals: 0'
  ]) {
    if (!doc.includes(token)) errors.push(`admin security documentation is missing: ${token}`);
  }

  if (errors.length) throw new Error(`Admin surface audit failed:\n${Array.from(new Set(errors)).join('\n')}`);

  console.log(`Admin surface OK: ${expected.summary.files_total} files, no external network/write/secret signals`);
}

main();
