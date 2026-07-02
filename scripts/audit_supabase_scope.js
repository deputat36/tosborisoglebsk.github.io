const fs = require('fs');
const path = require('path');

const root = process.cwd();

const allowedFiles = new Set([
  'assets/js/nav-v2/role-menu-v2.js',
  'assets/js/nav-v2/admin-guard-v2.js',
  'tools/patch_vktg_nav_roles.py',
  'scripts/audit_supabase_scope.js',
  'scripts/audit_project_mode.js'
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

  files.forEach((filePath) => {
    const repoPath = toRepoPath(filePath);
    if (!checkedExtensions.has(path.extname(repoPath))) return;

    const text = fs.readFileSync(filePath, 'utf8');
    const lower = text.toLowerCase();
    if (!lower.includes('supabase')) return;

    if (!allowedFiles.has(repoPath)) {
      errors.push(`unexpected supabase reference in ${repoPath}`);
    }
  });

  allowedFiles.forEach((repoPath) => {
    if (!fs.existsSync(path.join(root, repoPath))) {
      errors.push(`allowed Supabase scope file is missing: ${repoPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Supabase scope audit failed:\n${errors.join('\n')}`);
  }

  console.log('Supabase scope OK');
}

main();
