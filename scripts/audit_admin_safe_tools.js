const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'admin', 'index.html');
const EXPORT_PATH = path.join(ROOT, 'admin', 'admin-export-tools.js');
const HISTORY_PATH = path.join(ROOT, 'admin', 'admin-history.js');
const DOC_PATH = path.join(ROOT, 'docs', 'ADMIN-SAFE-TOOLS-2026-07-13.md');
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

const indexHtml = read(INDEX_PATH, 'admin index');
const exportTools = read(EXPORT_PATH, 'admin export tools');
const history = read(HISTORY_PATH, 'admin history tools');
const documentation = read(DOC_PATH, 'safe admin tools documentation');

const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];
if (scripts.join('|') !== expectedScripts.join('|')) {
  errors.push(`admin scripts must be ordered as ${expectedScripts.join(', ')}; found ${scripts.join(', ')}`);
}
if (new Set(scripts).size !== scripts.length) errors.push('admin index contains duplicate script sources');

requireTokens(indexHtml, [
  'Перед массовой или рискованной правкой создайте снимок',
  'CSV текущего отфильтрованного списка',
  'Для каждого раздела хранится до 10 снимков',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
], 'admin index');

requireTokens(exportTools, [
  'function csvCell(value)',
  'function orderedKeys(items)',
  'function visibleItems()',
  "if(typeof filtered === 'function') return filtered().map(row => row.item)",
  'function exportFilteredCsv()',
  "const csv = '\\ufeff'",
  ".join(';')",
  'admin-${state.section}-filtered-${date}.csv',
  'CSV текущего списка',
  'В текущем фильтре нет записей для экспорта'
], 'admin export tools');

requireTokens(history, [
  'const MAX_SNAPSHOTS = 10',
  'const AUTO_SNAPSHOT_IDS = new Set',
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
  'confirm(`Восстановить снимок',
  'state.data[section] = clone(target.data)',
  'localStorage.setItem',
  'Создать снимок',
  'Откатить'
], 'admin history tools');

const forbiddenNetworkPatterns = [
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
[
  ['admin export tools', exportTools],
  ['admin history tools', history]
].forEach(([label, text]) => {
  forbiddenNetworkPatterns.forEach((pattern) => {
    if (pattern.test(text)) errors.push(`${label} must not contain network or credential pattern ${pattern}`);
  });
});

requireTokens(documentation, [
  'CSV-экспорт текущей отфильтрованной выборки',
  'максимум 10 снимков на раздел',
  'before-restore',
  'не используют `fetch`, XMLHttpRequest или WebSocket',
  'не меняет JSON-схемы'
], 'safe admin tools documentation');

if (errors.length) {
  throw new Error(`Admin safe tools audit failed:\n${errors.join('\n')}`);
}

console.log('Admin safe tools audit OK: filtered CSV, 10 local snapshots and rollback safeguards verified');
