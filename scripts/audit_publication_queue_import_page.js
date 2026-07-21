const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'publication-import', 'index.html');
const contractPath = path.join(process.cwd(), 'assets', 'js', 'publication-queue-contract.js');
const validationPath = path.join(process.cwd(), 'assets', 'js', 'publication-queue-import-validation.js');
const appPath = path.join(process.cwd(), 'assets', 'js', 'publication-queue-import.js');
const cssPath = path.join(process.cwd(), 'assets', 'css', 'publication-queue-import.css');

const requiredControls = [
  'import-workspace',
  'queue-import-file',
  'intake-import-file',
  'current-queue-status',
  'import-status',
  'import-summary',
  'import-candidate-list',
  'download-approved-rows',
  'download-merged-preview',
  'reset-import'
];
const requiredRoutes = [
  '/update-tos/',
  '/publication-queue/',
  '/content-intake/',
  '/data/publication_queue.csv'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const errors = [];
  const html = read(pagePath);
  const htmlLower = html.toLocaleLowerCase('ru');
  const contract = read(contractPath);
  const validation = read(validationPath);
  const app = read(appPath);
  const css = read(cssPath);

  if (!html.includes('<title>Предварительный импорт редакционной очереди — ТОС БГО</title>')) errors.push('page title is missing');
  if (!html.includes('<meta name="robots" content="noindex,follow"')) errors.push('page must remain noindex');
  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/publication-import/"')) errors.push('canonical is missing');
  if (!html.includes('Без автоматической записи') || !html.includes('не изменяет <code>data/publication_queue.csv</code>')) errors.push('no-write limitation is missing');
  if (!html.includes('Группового подтверждения нет') || !html.includes('каждую строку нужно просмотреть отдельно')) errors.push('manual per-row review must be explicit');
  if (!html.includes('остаётся <code>draft</code>') || !html.includes('<code>ready</code>')) errors.push('draft-only status boundary is missing');
  if (!html.includes('<code>checking</code>') || !html.includes('<code>rejected</code>')) errors.push('canonical queue statuses are missing');
  if (!html.includes('<code>incoming-*</code>') || !html.includes('<code>queue-008</code>')) errors.push('temporary-to-canonical ID explanation is missing');
  if (!htmlLower.includes('карточка приёма может содержать контакт') || !htmlLower.includes('не должна попадать в публичный репозиторий')) errors.push('intake privacy warning is missing');

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing control #${id}`);
  });

  requiredRoutes.forEach((route) => {
    if (!html.includes(`href="${route}`)) errors.push(`missing route link ${route}`);
    if (!repoPathExists(route.split('?')[0].split('#')[0])) errors.push(`linked route does not exist ${route}`);
  });

  [
    '/assets/css/publication-queue-import.css',
    '/assets/js/publication-queue-contract.js',
    '/assets/js/publication-queue-import-validation.js',
    '/assets/js/publication-queue-import.js'
  ].forEach((asset) => {
    if (!html.includes(asset)) errors.push(`page does not include ${asset}`);
    if (!repoPathExists(asset)) errors.push(`asset does not exist ${asset}`);
  });

  const contractIndex = html.indexOf('/assets/js/publication-queue-contract.js');
  const validationIndex = html.indexOf('/assets/js/publication-queue-import-validation.js');
  const appIndex = html.indexOf('/assets/js/publication-queue-import.js');
  if (contractIndex < 0 || validationIndex < 0 || appIndex < 0 || contractIndex > validationIndex || validationIndex > appIndex) {
    errors.push('contract, validation and app scripts must load in that order');
  }

  if (!contract.includes("new Set(['draft', 'checking', 'ready', 'published', 'rejected'])")) errors.push('canonical status set is missing');
  if (!contract.includes('CANONICAL_ID_PATTERN') || !contract.includes('INCOMING_ID_PATTERN')) errors.push('queue ID patterns are missing');
  if (!contract.includes('assignCanonicalIds') || !contract.includes('nextCanonicalNumber')) errors.push('canonical ID allocator is missing');
  if (!validation.includes("status) !== 'draft'") || !validation.includes('clean(row.owner)')) errors.push('validation must enforce draft and blank owner');
  if (!validation.includes('classifyDuplicate') || !validation.includes('titleSimilarity')) errors.push('duplicate detection is missing');
  if (!validation.includes('canonicalizeApprovedRows') || !validation.includes('assignCanonicalIds')) errors.push('canonical export adapter is missing');
  if (!validation.includes('FORMULA_PREFIX') || !validation.includes('escapeFormula')) errors.push('formula protection is missing');
  if (!validation.includes('QUEUE_HEADERS') || !validation.includes('INTAKE_HEADERS')) errors.push('canonical CSV schemas are missing');

  if (!app.includes("fetch('/data/publication_queue.csv'")) errors.push('app must read current queue');
  if (!app.includes("method: 'GET'")) errors.push('current queue request must be explicit GET');
  if (!app.includes('new FileReader()')) errors.push('local files must use FileReader');
  if (!app.includes('state.approved') || !app.includes('duplicateOverrides')) errors.push('manual review state is missing');
  if (!app.includes("approve.type = 'checkbox'")) errors.push('per-row approval checkbox is missing');
  if (!app.includes('canonicalizeApprovedRows') || !app.includes('nextCanonicalNumber')) errors.push('app must export canonical queue IDs');
  if (!app.includes('download-approved-rows') || !app.includes('download-merged-preview')) errors.push('local export actions are missing');

  ['localStorage', 'sessionStorage', 'XMLHttpRequest', 'sendBeacon', 'WebSocket'].forEach((signal) => {
    if (app.includes(signal) || validation.includes(signal) || contract.includes(signal)) errors.push(`import must not persist or transmit data: ${signal}`);
  });
  ["method: 'POST'", "method: 'PUT'", "method: 'PATCH'", "method: 'DELETE'"].forEach((signal) => {
    if (app.includes(signal)) errors.push(`write request is forbidden: ${signal}`);
  });

  if (!css.includes('.import-candidate') || !css.includes('@media(max-width:680px)')) errors.push('responsive import styles are incomplete');

  if (errors.length) throw new Error(`Publication queue import page failed:\n${errors.join('\n')}`);
  console.log('Publication queue import page OK: canonical IDs, unified statuses, local-only and manually reviewed');
}

main();
