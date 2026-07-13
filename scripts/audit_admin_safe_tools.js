const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing required file ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireText(text, token, context) {
  if (!text.includes(token)) errors.push(`${context}: missing ${token}`);
}

function requirePattern(text, pattern, context) {
  if (!pattern.test(text)) errors.push(`${context}: missing pattern ${pattern}`);
}

const indexHtml = read('admin/index.html');
const exportTools = read('admin/admin-export-tools.js');
const historyTools = read('admin/admin-history.js');
const documentation = read('docs/ADMIN-SAFE-TOOLS-2026-07-13.md');
const packageText = read('package.json');
const projectMode = read('scripts/audit_project_mode.js');
const projectModeFull = read('scripts/audit_project_mode_full.js');

const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];
const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
if (scripts.join('|') !== expectedScripts.join('|')) {
  errors.push(`admin script order mismatch: ${scripts.join(', ')}`);
}
if (new Set(scripts).size !== scripts.length) errors.push('admin index contains duplicate scripts');

[
  'CSV текущего отфильтрованного списка',
  'Для каждого раздела хранится до 10 снимков',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
].forEach((token) => requireText(indexHtml, token, 'admin index'));

requirePattern(exportTools, /function\s+csvCell\s*\(/, 'CSV exporter');
requirePattern(exportTools, /function\s+orderedKeys\s*\(/, 'CSV exporter');
requirePattern(exportTools, /function\s+visibleItems\s*\(/, 'CSV exporter');
requirePattern(exportTools, /filtered\(\)\.map\([^)]*=>\s*[^)]*\.item\)/, 'CSV exporter');
requirePattern(exportTools, /function\s+exportFilteredCsv\s*\(/, 'CSV exporter');
requirePattern(exportTools, /(?:\\ufeff|\uFEFF)/i, 'CSV exporter BOM');
requirePattern(exportTools, /\.join\(['"]\;['"]\)/, 'CSV exporter delimiter');
requireText(exportTools, 'admin-${state.section}-filtered-${date}.csv', 'CSV exporter');
requireText(exportTools, 'CSV текущего списка', 'CSV exporter');
requireText(exportTools, 'В текущем фильтре нет записей для экспорта', 'CSV exporter');

requirePattern(historyTools, /const\s+MAX_SNAPSHOTS\s*=\s*10/, 'history');
requirePattern(historyTools, /const\s+AUTO_SNAPSHOT_IDS\s*=\s*new Set/, 'history');
[
  "'importJson'",
  "'addItem'",
  "'deleteItem'",
  "'duplicateItem'",
  "'autoFill'",
  "'fillLogo'",
  "'bulkFillLogoPaths'",
  'tosbgo_admin_history_${section}',
  'history.slice(-MAX_SNAPSHOTS)',
  "reason: 'before-restore'",
  'state.data[section] = clone(target.data)',
  'localStorage.setItem',
  'Создать снимок',
  'Откатить'
].forEach((token) => requireText(historyTools, token, 'history'));
requirePattern(historyTools, /confirm\(`Восстановить снимок/, 'history confirmation');

const forbiddenPatterns = [
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /WebSocket/i,
  /navigator\.sendBeacon/i,
  /api\.github\.com/i,
  /github_pat_/i,
  /ghp_[a-z0-9]/i,
  /authorization\s*:/i,
  /bearer\s+[a-z0-9]/i
];
for (const [label, text] of [['CSV exporter', exportTools], ['history', historyTools]]) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) errors.push(`${label}: forbidden network or credential pattern ${pattern}`);
  }
}

let packageJson = null;
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  errors.push(`package.json is invalid: ${error.message}`);
}
if (packageJson) {
  const scriptsConfig = packageJson.scripts || {};
  if (scriptsConfig['audit:admin-safe-tools'] !== 'node scripts/audit_admin_safe_tools.js') {
    errors.push('package.json does not define audit:admin-safe-tools');
  }
  if (!String(scriptsConfig['audit:all'] || '').includes('npm run audit:admin-safe-tools')) {
    errors.push('audit:all does not include audit:admin-safe-tools');
  }
}

requireText(projectMode, "['Admin safe tools', 'scripts/audit_admin_safe_tools.js']", 'project-mode');
requireText(projectModeFull, "['Admin safe tools audit', 'scripts/audit_admin_safe_tools.js']", 'full project-mode');

[
  'CSV-экспорт текущей отфильтрованной выборки',
  'максимум 10 снимков на раздел',
  'before-restore',
  'не используют `fetch`, XMLHttpRequest или WebSocket',
  'Пакет не меняет JSON-схемы'
].forEach((token) => requireText(documentation, token, 'documentation'));

if (errors.length) {
  throw new Error(`Admin safe tools audit failed:\n${errors.join('\n')}`);
}

console.log('Admin safe tools audit OK: filtered CSV, local snapshots, rollback and CI wiring verified');
