const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CORRECT_85_PUBLICATION = '0001202604090002';
const WRONG_85_PUBLICATION = '0001202604090023';
const CALENDAR_URL = '/legal/transition-calendar-2026-2028/';

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireFragments(errors, label, text, fragments) {
  fragments.forEach((fragment) => {
    if (!text.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function main() {
  const errors = [];
  const calendar = read('legal/transition-calendar-2026-2028/index.html');
  const legalIndex = read('legal/index.html');
  const federal = read('legal/federal-law-33/index.html');
  const changes = read('legal/changes-2025-2026/index.html');
  const updateDoc = read('docs/LEGAL-CONTENT-UPDATE-2026-09-10.md');
  const matrix = JSON.parse(read('data/legal_authority_matrix.json'));

  requireFragments(errors, 'transition calendar', calendar, [
    'Правовой календарь ТОС: 2026–2028',
    '01.01.2027',
    '01.01.2028',
    '№453 · 04.03.2026',
    'Новый общий порядок собраний граждан',
    '№479 · 06.04.2026',
    'Новый порядок публичных слушаний',
    CORRECT_85_PUBLICATION,
    'не юридическое заключение'
  ]);

  requireFragments(errors, 'legal index', legalIndex, [CALENDAR_URL, 'data-legal-transition-calendar']);
  requireFragments(errors, 'federal law page', federal, [CALENDAR_URL, CORRECT_85_PUBLICATION]);
  requireFragments(errors, 'changes page', changes, [CALENDAR_URL, '01.01.2027', '01.01.2028', CORRECT_85_PUBLICATION]);

  [calendar, federal, changes, updateDoc].forEach((text, index) => {
    if (text.includes(WRONG_85_PUBLICATION)) errors.push(`legal source ${index + 1}: stale 85-FZ publication number remains`);
  });

  const items = Array.isArray(matrix.items) ? matrix.items : [];
  const transition = items.find((item) => item.id === 'federal_transition_2026_2028');
  const hearings = items.find((item) => item.id === 'bgo_public_hearings_order_2026');
  if (!transition) errors.push('legal matrix: federal_transition_2026_2028 is missing');
  if (!hearings) errors.push('legal matrix: bgo_public_hearings_order_2026 is missing');
  if (transition && transition.official_source_url !== `https://publication.pravo.gov.ru/document/${CORRECT_85_PUBLICATION}`) {
    errors.push('legal matrix: transition official source is incorrect');
  }
  if (transition && !String(transition.transition_note || '').includes('01.01.2027')) errors.push('legal matrix: 2027 deadline is missing');
  if (transition && !String(transition.transition_note || '').includes('01.01.2028')) errors.push('legal matrix: 2028 deadline is missing');
  if (hearings && hearings.status !== 'requires_official_source') errors.push('legal matrix: BGO public hearings must remain requires_official_source');

  if (errors.length) throw new Error(`Legal transition content audit failed:\n${errors.join('\n')}`);
  console.log(`Legal transition content OK: ${items.length} matrix questions, 2027/2028 deadlines and BGO 453/479 separated`);
}

if (require.main === module) main();

module.exports = { main };
