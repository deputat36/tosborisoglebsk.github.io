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
  const patcher = read('scripts/patch_legal_transition_content.js');
  const federalVerifier = read('scripts/verify_federal_law_33_document.js');
  const trustPatcher = read('scripts/patch_p0_public_trust.js');
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

  requireFragments(errors, 'legal transition patcher', patcher, [
    `const WRONG_85_PUBLICATION = '${WRONG_85_PUBLICATION}'`,
    `const CORRECT_85_PUBLICATION = '${CORRECT_85_PUBLICATION}'`,
    `const CALENDAR_URL = '${CALENDAR_URL}'`,
    "'legal/federal-law-33/index.html'",
    "'legal/changes-2025-2026/index.html'",
    "'docs/LEGAL-CONTENT-UPDATE-2026-09-10.md'",
    "insertBeforeMainEnd('legal/index.html'",
    "insertBeforeMainEnd('legal/changes-2025-2026/index.html'",
    "insertBeforeMainEnd('legal/federal-law-33/index.html'",
    '01.01.2027',
    '01.01.2028'
  ]);

  requireFragments(errors, 'federal document verifier', federalVerifier, [
    `OFFICIAL_AMENDMENT_URL = 'https://publication.pravo.gov.ru/document/${CORRECT_85_PUBLICATION}'`,
    '01.01.2027',
    '01.01.2028',
    'legal_checked_at: \'2026-09-11\''
  ]);

  requireFragments(errors, 'public trust patcher', trustPatcher, [
    "require('./patch_legal_transition_content')",
    'patchLegalTransitionContent();'
  ]);

  if (calendar.includes(WRONG_85_PUBLICATION)) {
    errors.push('transition calendar: stale 85-FZ publication number remains');
  }
  if (federalVerifier.includes(WRONG_85_PUBLICATION)) {
    errors.push('federal document verifier: stale 85-FZ publication number remains');
  }

  const items = Array.isArray(matrix.items) ? matrix.items : [];
  const transition = items.find((item) => item.id === 'federal_transition_2026_2028');
  const meetings = items.find((item) => item.id === 'bgo_general_meetings_order_2026');
  const hearings = items.find((item) => item.id === 'bgo_public_hearings_order_2026');
  if (!transition) errors.push('legal matrix: federal_transition_2026_2028 is missing');
  if (!meetings) errors.push('legal matrix: bgo_general_meetings_order_2026 is missing');
  if (!hearings) errors.push('legal matrix: bgo_public_hearings_order_2026 is missing');
  if (transition && transition.official_source_url !== `https://publication.pravo.gov.ru/document/${CORRECT_85_PUBLICATION}`) {
    errors.push('legal matrix: transition official source is incorrect');
  }
  if (transition && !String(transition.transition_note || '').includes('01.01.2027')) errors.push('legal matrix: 2027 deadline is missing');
  if (transition && !String(transition.transition_note || '').includes('01.01.2028')) errors.push('legal matrix: 2028 deadline is missing');
  if (meetings && meetings.status !== 'requires_official_source') errors.push('legal matrix: BGO citizens meetings must remain requires_official_source');
  if (hearings && hearings.status !== 'requires_official_source') errors.push('legal matrix: BGO public hearings must remain requires_official_source');
  if (meetings && hearings && meetings.reference_source_url === hearings.reference_source_url) {
    errors.push('legal matrix: citizens meetings and public hearings must use distinct source records');
  }

  if (errors.length) throw new Error(`Legal transition content audit failed:\n${errors.join('\n')}`);
  console.log(`Legal transition content OK: ${items.length} matrix questions, 2027/2028 deadlines and BGO 453/479 separated`);
}

if (require.main === module) main();

module.exports = { main };
