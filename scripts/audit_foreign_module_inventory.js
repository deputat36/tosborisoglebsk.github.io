const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'data', 'foreign_module_inventory.json');
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
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
    if (module.classification !== 'foreign_or_orphaned') errors.push(`${label}: classification must be foreign_or_orphaned`);
    if (module.status !== 'quarantined_in_place') errors.push(`${label}: status must be quarantined_in_place`);
    if (module.belongs_to_tos_portal !== false) errors.push(`${label}: belongs_to_tos_portal must be false`);

    if (!Array.isArray(module.files) || !module.files.length) {
      errors.push(`${label}: files list is required`);
    } else {
      for (const file of module.files) {
        if (!file.path) {
          errors.push(`${label}: inventory file path is required`);
          continue;
        }
        if (!fs.existsSync(path.join(ROOT, file.path))) errors.push(`${label}: listed file is missing: ${file.path}`);
      }
    }

    const dependency = module.missing_dependency || {};
    if (!dependency.path) {
      errors.push(`${label}: missing_dependency.path is required`);
    } else if (dependency.expected_absent_while_quarantined && fs.existsSync(path.join(ROOT, dependency.path))) {
      errors.push(`${label}: quarantined dependency unexpectedly exists: ${dependency.path}`);
    }

    if (!Array.isArray(module.target_pages) || !module.target_pages.length) {
      errors.push(`${label}: target_pages list is required`);
    } else {
      for (const targetPage of module.target_pages) {
        if (fs.existsSync(path.join(ROOT, targetPage))) {
          errors.push(`${label}: quarantined target page unexpectedly exists: ${targetPage}`);
        }
      }
    }

    const expectedReferences = Number(module.public_html_references_expected || 0);
    if (navReferences.length !== expectedReferences) {
      errors.push(`${label}: expected ${expectedReferences} HTML references to nav-v2, found ${navReferences.length}: ${navReferences.join(', ')}`);
    }
  }

  if (errors.length) {
    throw new Error(`Foreign module quarantine audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Foreign module quarantine OK: ${(inventory.modules || []).length} module(s), ${navReferences.length} HTML references`);
}

main();
