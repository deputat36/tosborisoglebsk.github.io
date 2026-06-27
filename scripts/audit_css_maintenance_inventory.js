const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const inventoryPath = path.join(process.cwd(), 'data', 'css_maintenance_inventory.csv');
const expectedHeaders = [
  'item_id',
  'group',
  'selectors_or_area',
  'current_state',
  'risk',
  'safe_action',
  'status'
];
const requiredGroups = new Set([
  'tokens',
  'base',
  'header',
  'buttons',
  'hero',
  'grid-cards',
  'content',
  'home',
  'responsive',
  'print',
  'maintainability',
  'regression'
]);
const allowedStatuses = new Set(['planned', 'in_progress', 'done', 'blocked']);
const allowedRiskPrefixes = new Set(['Низкий', 'Средний', 'Высокий']);
const itemIdPattern = /^css-\d{3}$/;

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function riskPrefix(value) {
  return (value || '').split(':')[0].trim();
}

function main() {
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(`Missing file: ${inventoryPath}`);
  }

  const rows = parseCsv(fs.readFileSync(inventoryPath, 'utf8'));
  const errors = [];

  if (rows.length < 2) {
    throw new Error('CSS maintenance inventory audit failed:\ndata/css_maintenance_inventory.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seenIds = new Set();
  const seenGroups = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `css inventory row ${index + 2}`;
    const [itemId, group, selectorsOrArea, currentState, risk, safeAction, status] = row.map((cell) => (cell || '').trim());

    if (!itemIdPattern.test(itemId)) errors.push(`${line}: invalid item_id ${itemId}`);
    if (seenIds.has(itemId)) errors.push(`${line}: duplicate item_id ${itemId}`);
    if (itemId) seenIds.add(itemId);

    if (!requiredGroups.has(group)) errors.push(`${line}: unsupported group ${group}`);
    if (seenGroups.has(group)) errors.push(`${line}: duplicate group ${group}`);
    if (group) seenGroups.add(group);

    if (!selectorsOrArea) errors.push(`${line}: missing selectors_or_area`);
    if (!currentState || currentState.length < 20) errors.push(`${line}: current_state is too short`);
    if (!allowedRiskPrefixes.has(riskPrefix(risk))) errors.push(`${line}: unsupported risk ${risk}`);
    if (!safeAction || safeAction.length < 20) errors.push(`${line}: safe_action is too short`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);

    if (group === 'maintainability' && !repoPathExists(selectorsOrArea)) {
      errors.push(`${line}: maintainability target does not exist ${selectorsOrArea}`);
    }

    if (group === 'responsive' && !selectorsOrArea.includes('@media')) {
      errors.push(`${line}: responsive group must reference @media rules`);
    }

    if (riskPrefix(risk) === 'Высокий' && !/провер|тест/i.test(safeAction)) {
      errors.push(`${line}: high risk item must require testing or checking`);
    }
  });

  requiredGroups.forEach((group) => {
    if (!seenGroups.has(group)) {
      errors.push(`missing required CSS group ${group}`);
    }
  });

  if (!repoPathExists('assets/css/styles.css')) {
    errors.push('missing stylesheet assets/css/styles.css');
  }

  if (errors.length) {
    throw new Error(`CSS maintenance inventory audit failed:\n${errors.join('\n')}`);
  }

  console.log(`CSS maintenance inventory OK: ${rows.length - 1} rows`);
}

main();
