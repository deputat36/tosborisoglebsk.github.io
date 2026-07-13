const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN_DIR = path.join(ROOT, 'admin');
const errors = [];

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

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing required file ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
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

requiredFiles.forEach((file) => {
  if (!fs.existsSync(path.join(ROOT, file))) errors.push(`missing required admin file ${file}`);
});
forbiddenFiles.forEach((file) => {
  if (fs.existsSync(path.join(ROOT, file))) errors.push(`obsolete admin file must be removed ${file}`);
});

const indexHtml = read('admin/index.html');
const packageText = read('package.json');
const projectMode = read('scripts/audit_project_mode.js');
const projectModeFull = read('scripts/audit_project_mode_full.js');
const seoAudit = read('scripts/audit_seo.js');
const accessibilityPatch = read('scripts/patch_accessibility_internal_tools.js');
const documentation = read('docs/ADMIN-CONSOLIDATION-2026-07-13.md');
const logoTools = read('admin/admin-logo-tools.js');

if (!indexHtml.includes('<meta name="robots" content="noindex,nofollow"')) errors.push('admin index must remain noindex,nofollow');
if (!indexHtml.includes('Эта админка не записывает данные прямо в GitHub')) errors.push('admin index must explain local publication mode');
if (!indexHtml.includes('Прямая запись в GitHub намеренно не используется')) errors.push('admin index must prohibit direct GitHub write');

const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
if (scripts.join('|') !== expectedScripts.join('|')) errors.push(`unexpected admin scripts: ${scripts.join(', ')}`);
if (new Set(scripts).size !== scripts.length) errors.push('admin index contains duplicate script sources');

['bulkFillLogoPaths','downloadNoLogoCsv','option value="no-logo"','/assets/img/tos-logos/'].forEach((token) => {
  if (!logoTools.includes(token)) errors.push(`logo tools missing ${token}`);
});

const forbiddenNames = forbiddenFiles.map((file) => path.basename(file));
const referenceFiles = [
  ...walk(ADMIN_DIR),
  ...walk(path.join(ROOT, 'scripts')).filter((file) => file.endsWith('.js')),
  ...walk(path.join(ROOT, '.github', 'workflows')).filter((file) => /\.ya?ml$/i.test(file))
];
for (const filePath of referenceFiles) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (relative === 'scripts/audit_admin_consolidation.js') continue;
  const text = fs.readFileSync(filePath, 'utf8');
  forbiddenNames.forEach((name) => {
    if (text.includes(name)) errors.push(`obsolete filename ${name} is referenced in ${relative}`);
  });
}

if (seoAudit.includes('admin/admin-index-ready.html')) errors.push('SEO audit still references obsolete admin copy');
if (accessibilityPatch.includes('admin-index-ready.html')) errors.push('accessibility patcher still references obsolete admin copy');

const credentialPatterns = [
  /github_pat_/i,
  /ghp_[a-z0-9]/i,
  /api\.github\.com/i,
  /authorization\s*:/i,
  /bearer\s+[a-z0-9]/i,
  /localStorage[^\n]{0,100}token/i,
  /sessionStorage[^\n]{0,100}token/i
];
for (const filePath of walk(ADMIN_DIR).filter((file) => file.endsWith('.js'))) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const pattern of credentialPatterns) {
    if (pattern.test(text)) errors.push(`credential/API pattern ${pattern} in ${path.relative(ROOT, filePath)}`);
  }
}

let packageJson = null;
try { packageJson = JSON.parse(packageText); } catch (error) { errors.push(`invalid package.json: ${error.message}`); }
if (packageJson) {
  const config = packageJson.scripts || {};
  if (!/\badmin\b/.test(String(config['check:js'] || ''))) errors.push('check:js must include admin');
  if (config['audit:admin-consolidation'] !== 'node scripts/audit_admin_consolidation.js') errors.push('missing audit:admin-consolidation script');
  if (!String(config['audit:all'] || '').includes('npm run audit:admin-consolidation')) errors.push('audit:all must include admin consolidation');
}

if (!projectMode.includes("['Admin consolidation', 'scripts/audit_admin_consolidation.js']")) errors.push('normal project-mode missing admin consolidation');
if (!projectModeFull.includes("['Admin consolidation audit', 'scripts/audit_admin_consolidation.js']")) errors.push('full project-mode missing admin consolidation');

[
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
].forEach((token) => {
  if (!documentation.includes(token)) errors.push(`documentation missing ${token}`);
});

if (errors.length) throw new Error(`Admin consolidation audit failed:\n${errors.join('\n')}`);
console.log('Admin consolidation audit OK: one page, five modules, obsolete files absent, credential/API patterns 0');
