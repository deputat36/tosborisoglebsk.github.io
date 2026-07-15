const fs = require('fs');
const path = require('path');

const root = process.cwd();

const allowedReferenceFiles = new Set([
  'scripts/audit_supabase_scope.js',
  'scripts/audit_project_mode.js',
  'scripts/audit_project_mode_full.js',
  'data/foreign_module_inventory.json',
  'docs/NAV-V2-ISOLATION.md',
  'docs/AUDIT-2026-07-10.md',
  'docs/STATUS.md'
]);

const ignoredDirs = new Set([
  '.git',
  'node_modules'
]);

const checkedExtensions = new Set([
  '.html',
  '.js',
  '.json',
  '.csv',
  '.md',
  '.py'
]);

function walk(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (ignoredDirs.has(entry.name)) return;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      return;
    }
    files.push(fullPath);
  });
  return files;
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function main() {
  const errors = [];
  const files = walk(root);
  const foundReferenceFiles = new Set();

  files.forEach((filePath) => {
    const repoPath = toRepoPath(filePath);
    if (!checkedExtensions.has(path.extname(repoPath))) return;

    const text = fs.readFileSync(filePath, 'utf8');
    const lower = text.toLowerCase();
    if (!lower.includes('supabase')) return;

    foundReferenceFiles.add(repoPath);

    if (!allowedReferenceFiles.has(repoPath)) {
      errors.push(`unexpected supabase reference in ${repoPath}`);
    }
  });

  if (!foundReferenceFiles.has('scripts/audit_supabase_scope.js')) {
    errors.push('scripts/audit_supabase_scope.js must be visible to its own scope check');
  }

  for (const removedPath of [
    'assets/js/nav-v2/role-menu-v2.js',
    'assets/js/nav-v2/admin-guard-v2.js',
    'tools/patch_vktg_nav_roles.py'
  ]) {
    if (fs.existsSync(path.join(root, removedPath))) {
      errors.push(`foreign nav-v2 file must remain absent: ${removedPath}`);
    }
  }

  if (errors.length) {
    throw new Error(`Supabase scope audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Supabase scope OK: ${foundReferenceFiles.size} documentation and audit files with references`);
}

main();
