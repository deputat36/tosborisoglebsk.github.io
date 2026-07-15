const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'data', 'foreign_module_inventory.json');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const EXPECTED_CANONICAL_REPOSITORY = 'deputat36/vktg';
const EXPECTED_REMOVED_PATHS = new Set([
  'assets/js/nav-v2/admin-guard-v2.js',
  'assets/js/nav-v2/role-menu-v2.js',
  'tools/patch_vktg_nav_roles.py'
]);
const ALLOWED_RELATIONSHIPS = new Set([
  'exact_copy',
  'superseded_by_newer_canonical'
]);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function isBlobSha(value) {
  return /^[0-9a-f]{40}$/i.test(String(value || ''));
}

function main() {
  const errors = [];

  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`Missing inventory: ${INVENTORY_PATH}`);
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  if (!Array.isArray(inventory.modules) || !inventory.modules.length) {
    errors.push('foreign module inventory must contain modules');
  }

  const htmlFiles = walk(ROOT).filter((filePath) => path.extname(filePath).toLowerCase() === '.html');
  const navReferences = [];
  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    if (/assets\/js\/nav-v2\//i.test(html)) {
      navReferences.push(path.relative(ROOT, filePath).replace(/\\/g, '/'));
    }
  }

  for (const module of inventory.modules || []) {
    const label = module.id || '(unknown module)';
    if (!module.id) errors.push('module id is required');
    if (module.classification !== 'foreign_or_orphaned') {
      errors.push(`${label}: classification must be foreign_or_orphaned`);
    }
    if (module.status !== 'removed_after_canonical_confirmation') {
      errors.push(`${label}: status must be removed_after_canonical_confirmation`);
    }
    if (module.belongs_to_tos_portal !== false) {
      errors.push(`${label}: belongs_to_tos_portal must be false`);
    }

    const canonical = module.canonical_repository || {};
    if (canonical.full_name !== EXPECTED_CANONICAL_REPOSITORY) {
      errors.push(`${label}: canonical repository must be ${EXPECTED_CANONICAL_REPOSITORY}`);
    }
    if (canonical.default_branch !== 'main') {
      errors.push(`${label}: canonical default branch must be main`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(canonical.verified_at || ''))) {
      errors.push(`${label}: canonical verified_at must be YYYY-MM-DD`);
    }

    if (!Array.isArray(module.removed_files) || !module.removed_files.length) {
      errors.push(`${label}: removed_files list is required`);
    } else {
      const actualPaths = new Set();
      for (const file of module.removed_files) {
        if (!file.local_path) {
          errors.push(`${label}: removed file local_path is required`);
          continue;
        }
        actualPaths.add(file.local_path);
        if (!EXPECTED_REMOVED_PATHS.has(file.local_path)) {
          errors.push(`${label}: unexpected removed path: ${file.local_path}`);
        }
        if (fs.existsSync(path.join(ROOT, file.local_path))) {
          errors.push(`${label}: removed foreign file returned: ${file.local_path}`);
        }
        if (!file.canonical_path) {
          errors.push(`${label}: canonical_path is required for ${file.local_path}`);
        }
        if (!isBlobSha(file.former_local_blob_sha)) {
          errors.push(`${label}: former_local_blob_sha is invalid for ${file.local_path}`);
        }
        if (!isBlobSha(file.canonical_blob_sha)) {
          errors.push(`${label}: canonical_blob_sha is invalid for ${file.local_path}`);
        }
        if (!ALLOWED_RELATIONSHIPS.has(file.relationship)) {
          errors.push(`${label}: unsupported relationship for ${file.local_path}: ${file.relationship}`);
        }
        if (file.relationship === 'exact_copy' && file.former_local_blob_sha !== file.canonical_blob_sha) {
          errors.push(`${label}: exact_copy blob mismatch for ${file.local_path}`);
        }
        if (
          file.relationship === 'superseded_by_newer_canonical' &&
          file.former_local_blob_sha === file.canonical_blob_sha
        ) {
          errors.push(`${label}: superseded file must have a different canonical blob: ${file.local_path}`);
        }
      }

      for (const expectedPath of EXPECTED_REMOVED_PATHS) {
        if (!actualPaths.has(expectedPath)) {
          errors.push(`${label}: removed path is missing from inventory: ${expectedPath}`);
        }
      }
    }

    const dependency = module.missing_dependency || {};
    if (!dependency.path) {
      errors.push(`${label}: missing_dependency.path is required`);
    } else if (dependency.expected_absent && fs.existsSync(path.join(ROOT, dependency.path))) {
      errors.push(`${label}: foreign dependency unexpectedly exists: ${dependency.path}`);
    }

    if (!Array.isArray(module.target_pages) || !module.target_pages.length) {
      errors.push(`${label}: target_pages list is required`);
    } else {
      for (const targetPage of module.target_pages) {
        if (fs.existsSync(path.join(ROOT, targetPage))) {
          errors.push(`${label}: foreign target page unexpectedly exists: ${targetPage}`);
        }
      }
    }

    const expectedReferences = Number(module.public_html_references_expected || 0);
    if (navReferences.length !== expectedReferences) {
      errors.push(
        `${label}: expected ${expectedReferences} HTML references to nav-v2, found ${navReferences.length}: ${navReferences.join(', ')}`
      );
    }

    if (!Array.isArray(module.decision_evidence) || module.decision_evidence.length < 3) {
      errors.push(`${label}: decision_evidence must contain at least three facts`);
    }
  }

  if (errors.length) {
    throw new Error(`Foreign module removal audit failed:\n${errors.join('\n')}`);
  }

  console.log(
    `Foreign module removal OK: ${(inventory.modules || []).length} module(s), ` +
    `${EXPECTED_REMOVED_PATHS.size} removed paths, ${navReferences.length} HTML references`
  );
}

main();
