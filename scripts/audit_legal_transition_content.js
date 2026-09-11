const fs = require('fs');
const path = require('path');
const { patchLegalTransitionContent } = require('./patch_legal_transition_content');

const ROOT = process.cwd();
const CORRECT_85_PUBLICATION = '0001202604090002';
const WRONG_85_PUBLICATION = '0001202604090023';
const FEDERAL_23_PUBLICATION = '0001202602200044';
const FEDERAL_333_PUBLICATION = '0001202608040076';
const CALENDAR_URL = '/legal/transition-calendar-2026-2028/';
const HOUSING_CONTROL_ID = 'municipal_housing_control_transition_2026_2028';

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
  // The legal patch is deterministic and idempotent. Materialize it here so
  // focused governance workflows inspect the same legal state as the main build.
  patchLegalTransitionContent();

  const errors = [];
  const calendar = read('legal/transition-calendar-2026-2028/index.html');
  const changes = read('legal/changes-2025-2026/index.html');
  const patcher = read('scripts/patch_legal_transition_content.js');
  const federalVerifier = read('scripts/verify_federal_law_33_document.js');
  const trustPatcher = read('scripts/patch_p0_public_trust.js');
  const matrix = JSON.parse(read('data/legal_authority_matrix.json'));

  requireFragments(errors, 'transition calendar', calendar, [
    'Правовой календарь ТОС: 2026–2028',
    '01.01.2027',
    '01.01.2028',
    '01.09.2026',
    '№453 · 04.03.2026',
    'Новый общий порядок собраний граждан',
    '№479 · 06.04.2026',
    'Новый порядок публичных слушаний',
    '23-ФЗ',
    '333-ФЗ',
    CORRECT_85_PUBLICATION,
    FEDERAL_23_PUBLICATION,
    FEDERAL_333_PUBLICATION,
    'не юридическое заключение'
  ]);

  requireFragments(errors, 'changes page', changes, [
    'Изменилось регулирование жилищного контроля',
    '01.09.2026',
    '1 января 2028 года',
    '333-ФЗ'
  ]);

  requireFragments(errors, 'legal transition patcher', patcher, [
    `const WRONG_85_PUBLICATION = '${WRONG_85_PUBLICATION}'`,
    `const CORRECT_85_PUBLICATION = '${CORRECT_85_PUBLICATION}'`,
    `const FEDERAL_23_PUBLICATION = '${FEDERAL_23_PUBLICATION}'`,
    `const FEDERAL_333_PUBLICATION = '${FEDERAL_333_PUBLICATION}'`,
    `const CALENDAR_URL = '${CALENDAR_URL}'`,
    "id: 'municipal_housing_control_transition_2026_2028'",
    "effective_from: '2026-09-01'",
    "'legal/federal-law-33/index.html'",
    "'legal/changes-2025-2026/index.html'",
    "'docs/LEGAL-CONTENT-UPDATE-2026-09-10.md'",
    "insertBeforeMainEnd('legal/index.html'",
    "insertBeforeMainEnd('legal/changes-2025-2026/index.html'",
    "insertBeforeMainEnd('legal/federal-law-33/index.html'",
    'upsertHousingControlMatrix();',
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
  const housing = items.find((item) => item.id === HOUSING_CONTROL_ID);
  const meetings = items.find((item) => item.id === 'bgo_general_meetings_order_2026');
  const hearings = items.find((item) => item.id === 'bgo_public_hearings_order_2026');
  if (!transition) errors.push('legal matrix: federal_transition_2026_2028 is missing');
  if (!housing) errors.push(`legal matrix: ${HOUSING_CONTROL_ID} is missing`);
  if (!meetings) errors.push('legal matrix: bgo_general_meetings_order_2026 is missing');
  if (!hearings) errors.push('legal matrix: bgo_public_hearings_order_2026 is missing');
  if (transition && transition.official_source_url !== `https://publication.pravo.gov.ru/document/${CORRECT_85_PUBLICATION}`) {
    errors.push('legal matrix: transition official source is incorrect');
  }
  if (transition && !String(transition.transition_note || '').includes('01.01.2027')) errors.push('legal matrix: 2027 deadline is missing');
  if (transition && !String(transition.transition_note || '').includes('01.01.2028')) errors.push('legal matrix: 2028 deadline is missing');
  if (housing && housing.status !== 'verified_current') errors.push('legal matrix: housing control transition must be verified_current');
  if (housing && housing.effective_from !== '2026-09-01') errors.push('legal matrix: housing control effective date must be 2026-09-01');
  if (housing && housing.official_source_url !== `https://publication.pravo.gov.ru/document/${FEDERAL_333_PUBLICATION}`) {
    errors.push('legal matrix: housing control 333-FZ official source is incorrect');
  }
  if (housing && !String(housing.transition_note || '').includes('01.09.2026')) errors.push('legal matrix: housing control September 2026 date is missing');
  if (housing && !String(housing.transition_note || '').includes('01.01.2028')) errors.push('legal matrix: housing control 2028 date is missing');
  if (housing && !String(housing.basis_hint || '').includes('№23-ФЗ')) errors.push('legal matrix: housing control 23-FZ basis is missing');
  if (housing && !String(housing.basis_hint || '').includes('№333-ФЗ')) errors.push('legal matrix: housing control 333-FZ basis is missing');
  if (meetings && meetings.status !== 'requires_official_source') errors.push('legal matrix: BGO citizens meetings must remain requires_official_source');
  if (hearings && hearings.status !== 'requires_official_source') errors.push('legal matrix: BGO public hearings must remain requires_official_source');
  if (meetings && hearings && meetings.reference_source_url === hearings.reference_source_url) {
    errors.push('legal matrix: citizens meetings and public hearings must use distinct source records');
  }

  if (errors.length) throw new Error(`Legal transition content audit failed:\n${errors.join('\n')}`);
  console.log(`Legal transition content OK: ${items.length} matrix questions, 23/333-FZ housing transition, 2027/2028 deadlines and BGO 453/479 separated`);
}

if (require.main === module) main();

module.exports = { main };
