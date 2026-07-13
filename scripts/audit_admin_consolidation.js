const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN_DIR = path.join(ROOT, 'admin');
const INDEX_PATH = path.join(ADMIN_DIR, 'index.html');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const SEO_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_seo.js');
const ACCESSIBILITY_PATCH_PATH = path.join(ROOT, 'scripts', 'patch_accessibility_internal_tools.js');
const DOC_PATH = path.join(ROOT, 'docs', 'ADMIN-CONSOLIDATION-2026-07-13.md');

const requiredFiles = [
  'admin/index.html',
  'admin/admin.css',
  'admin/admin2.js',
  'admin/admin-logo-tools.js',
  'admin/admin-dashboard.js',
  'admin/admin-export-tools.js',
  'admin/admin-history.js',
  'docs/ADMIN-CONSOLIDATION-2026-07-13.md',
  'docs/ADMIN-SAFE-TOOLS-2026-07-13.md'
];

const forbiddenFiles = [
  'admin/admin-index-ready.html',
  'admin/admin.js',
  'admin/admin-logo-bulk.js',
  'admin/admin-mass-autofill.js',
  'admin/admin-mass-fill-all.js',
  'admin/admin-mass-all-autofill.js'
];

const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];

const errors = [];

function read(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

requiredFiles.forEach((relativePath) => {
  if (!fs.existsSync(path.join(ROOT, relativePath))) errors.push(`missing required admin file ${relativePath}`);
});

forbiddenFiles.forEach((relativePath) => {
  if (fs.existsSync(path.join(ROOT, relativePath))) errors.push(`obsolete admin file must be removed ${relativePath}`);
});

const indexHtml = read(INDEX_PATH, 'admin index');
const packageText = read(PACKAGE_PATH, 'package.json');
const projectMode = read(PROJECT_MODE_PATH, 'project-mode audit');
const projectModeFull = read(PROJECT_MODE_FULL_PATH, 'full project-mode audit');
const seoAudit = read(SEO_AUDIT_PATH, 'SEO audit');
const accessibilityPatch = read(ACCESSIBILITY_PATCH_PATH, 'accessibility patcher');
const documentation = read(DOC_PATH, 'admin consolidation documentation');
const logoTools = read(path.join(ADMIN_DIR, 'admin-logo-tools.js'), 'logo tools');

if (!indexHtml.includes('<meta name="robots" content="noindex,nofollow"')) {
  errors.push('admin index must remain noindex,nofollow');
}

requireTokens(indexHtml, [
  'Эта админка не записывает данные прямо в GitHub',
  'Прямая запись в GitHub намеренно не используется'
], 'admin index');

const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
if (scripts.length !== expectedScripts.length) {
  errors.push(`admin index must contain exactly ${expectedScripts.length} scripts, found ${scripts.length}`);
}
if (new Set(scripts).size !== scripts.length) errors.push('admin index contains duplicate script sources');
if (scripts.join('|') !== expectedScripts.join('|')) {
  errors.push(`admin scripts must be ordered as ${expectedScripts.join(', ')}; found ${scripts.join(', ')}`);
}

requireTokens(logoTools, [
  'bulkFillLogoPaths',
  'downloadNoLogoCsv',
  'option value="no-logo"',
  '/assets/img/tos-logos/'
], 'admin logo tools');

const forbiddenNames = forbiddenFiles.map((file) => path.basename(file));
const referenceFiles = [
  ...walk(ADMIN_DIR),
  ...walk(path.join(ROOT, 'scripts')).filter((file) => file.endsWith('.js')),
  ...walk(path.join(ROOT, '.github', 'workflows')).filter((file) => /\.ya?ml$/i.test(file))
];
referenceFiles.forEach((filePath) => {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (relative === 'scripts/audit_admin_consolidation.js') return;
  const text = fs.readFileSync(filePath, 'utf8');
  forbiddenNames.forEach((name) => {
    if (text.includes(name)) errors.push(`obsolete admin filename ${name} is still referenced in ${relative}`);
  });
});

if (seoAudit.includes('admin/admin-index-ready.html')) {
  errors.push('SEO audit still contains obsolete admin/admin-index-ready.html exclusion');
}
if (accessibilityPatch.includes('admin-index-ready.html')) {
  errors.push('accessibility patcher still targets obsolete admin-index-ready.html');
}

const adminJsFiles = walk(ADMIN_DIR).filter((file) => file.endsWith('.js'));
const credentialPatterns = [
  /github_pat_/i,
  /ghp_[a-z0-9]/i,
  /api\.github\.com/i,
  /authorization\s*:/i,
  /bearer\s+[a-z0-9]/i,
  /localStorage[^\n]{0,100}token/i,
  /sessionStorage[^\n]{0,100}token/i
];
adminJsFiles.forEach((filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  credentialPatterns.forEach((pattern) => {
    if (pattern.test(text)) {
      errors.push(`admin client code contains forbidden credential/API pattern ${pattern} in ${path.relative(ROOT, filePath)}`);
    }
  });
});

let packageJson = null;
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  errors.push(`package.json is invalid JSON: ${error.message}`);
}
if (packageJson) {
  const scriptsConfig = packageJson.scripts || {};
  const checkJs = String(scriptsConfig['check:js'] || '');
  if (!/\badmin\b/.test(checkJs)) errors.push('check:js must include the admin directory');
  if (scriptsConfig['audit:admin-consolidation'] !== 'node scripts/audit_admin_consolidation.js') {
    errors.push('package.json must define audit:admin-consolidation');
  }
  if (!String(scriptsConfig['audit:all'] || '').includes('npm run audit:admin-consolidation')) {
    errors.push('audit:all must include audit:admin-consolidation');
  }
}

requireTokens(projectMode, [
  "['Admin consolidation', 'scripts/audit_admin_consolidation.js']"
], 'project-mode audit');
requireTokens(projectModeFull, [
  "['Admin consolidation audit', 'scripts/audit_admin_consolidation.js']"
], 'full project-mode audit');

requireTokens(documentation, [
  'Оставлена одна страница',
  'admin/admin2.js',
  'admin/admin-logo-tools.js',
  'admin/admin-dashboard.js',
  'admin/admin-export-tools.js',
  'admin/admin-history.js',
  'Удалённые файлы',
  'не обращается к `api.github.com`',
  'Прямая запись в GitHub намеренно не используется',
  'одна поддерживаемая HTML-страница и пять модулей'
], 'admin consolidation documentation');

if (errors.length) {
  throw new Error(`Admin consolidation audit failed:\n${errors.join('\n')}`);
}

console.log(`Admin consolidation audit OK: ${scripts.length} supported scripts, ${forbiddenFiles.length} obsolete files absent, credential/API patterns 0`);
