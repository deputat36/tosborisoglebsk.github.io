const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WRONG_85_PUBLICATION = '0001202604090023';
const CORRECT_85_PUBLICATION = '0001202604090002';
const FEDERAL_23_PUBLICATION = '0001202602200044';
const FEDERAL_333_PUBLICATION = '0001202608040076';
const CALENDAR_URL = '/legal/transition-calendar-2026-2028/';
const HOUSING_CONTROL_MARKER = 'data-legal-housing-control-transition';

const LEGAL_INDEX_SECTION = `
<section class="section" data-legal-transition-calendar><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag warn">Контрольные даты</span><h2>Переход от 131-ФЗ к 33-ФЗ: что проверить в 2026–2028 годах</h2><p>Муниципальные правовые акты по вопросам организации местного самоуправления должны быть приведены в соответствие с 33-ФЗ не позднее 1 января 2027 года. Основной переходный срок и прекращение действия 131-ФЗ перенесены на 1 января 2028 года.</p><div class="card-actions"><a class="btn primary" href="${CALENDAR_URL}">Открыть правовой календарь</a><a class="btn" href="/legal/changes-2025-2026/">Изменения для БГО</a></div></div></article></div></section>`;

const CHANGES_SECTION = `
  <section class="section" data-legal-transition-calendar><div class="container section-head"><div><h2>Контрольные даты переходного периода</h2><p>Почему 1 января 2027 и 1 января 2028 означают разные юридические этапы</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag warn">01.01.2027</span><h3>Муниципальные акты должны быть приведены в соответствие</h3><p>Часть 2 статьи 91 33-ФЗ устанавливает этот срок для региональных и муниципальных правовых актов по вопросам организации местного самоуправления.</p></div></article><article class="card"><div class="card-inner"><span class="tag">01.01.2028</span><h3>Завершается основной переходный период</h3><p>До этой даты действует переходная конструкция статьи 91, а с этой даты 131-ФЗ признаётся утратившим силу в соответствии со статьёй 93.</p></div></article><article class="card"><div class="card-inner"><span class="tag ok">Практика</span><h3>Старый шаблон нельзя применять автоматически</h3><p>Проверяйте конкретный предмет регулирования, дату муниципального акта и зарегистрированный устав своего ТОС.</p><a class="btn" href="${CALENDAR_URL}">Подробный календарь</a></div></article></div></section>`;

const FEDERAL_CALENDAR_CARD = `
  <section class="section" data-legal-transition-calendar><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag warn">Переходный период</span><h2>Две даты, которые нельзя путать</h2><p><b>1 января 2027 года</b> — предельный срок приведения региональных и муниципальных правовых актов в соответствие с 33-ФЗ. <b>1 января 2028 года</b> — завершение основной переходной конструкции и дата, с которой 131-ФЗ признаётся утратившим силу.</p><a class="btn primary" href="${CALENDAR_URL}">Открыть правовой календарь 2026–2028</a></div></article></div></section>`;

const HOUSING_CONTROL_SECTION = `
  <section class="section" ${HOUSING_CONTROL_MARKER}><div class="container section-head"><div><h2>Жилищный контроль: отдельный переход 2026–2028</h2><p>23-ФЗ и 333-ФЗ меняют распределение полномочий; это важно для правильной маршрутизации обращений жителей</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag ok">01.09.2026</span><h3>Основная часть 23-ФЗ вступила в силу</h3><p>Федеральный закон №23-ФЗ от 20.02.2026 изменил нормы о муниципальном жилищном контроле в 131-ФЗ, Жилищном кодексе и связанных актах. Для практической работы не следует автоматически направлять жилищные обращения по старой схеме «в муниципальный жилищный контроль» без проверки действующей компетенции.</p><a class="btn" href="https://publication.pravo.gov.ru/document/${FEDERAL_23_PUBLICATION}" target="_blank" rel="noopener noreferrer">23-ФЗ: официальная публикация</a></div></article><article class="card"><div class="card-inner"><span class="tag warn">01.01.2028</span><h3>Отдельная норма 33-ФЗ отложена до 2028 года</h3><p>Статья 6 закона №23-ФЗ исключает подпункт «д» пункта 29 части 2 статьи 32 закона №33-ФЗ. Федеральный закон №333-ФЗ от 04.08.2026 перенёс вступление этой статьи 6 с 1 января 2027 года на <b>1 января 2028 года</b>.</p><a class="btn" href="https://publication.pravo.gov.ru/document/${FEDERAL_333_PUBLICATION}" target="_blank" rel="noopener noreferrer">333-ФЗ: официальная публикация</a></div></article><article class="card"><div class="card-inner"><span class="tag">Для ТОС</span><h3>Не путайте переход закона и адресата обращения</h3><p>Эти поправки не создают отдельного полномочия ТОС. Если жители жалуются на содержание многоквартирного дома или соблюдение жилищных требований, сначала проверьте, какой орган компетентен рассматривать конкретный вопрос в действующей редакции законодательства.</p></div></article></div></section>`;

const CHANGES_HOUSING_SECTION = `
  <section class="section" ${HOUSING_CONTROL_MARKER}><div class="container grid"><article class="card full"><div class="card-inner"><span class="tag ok">С 01.09.2026</span><h2>Изменилось регулирование жилищного контроля</h2><p>23-ФЗ изменил нормы о муниципальном жилищном контроле, а 333-ФЗ перенёс вступление в силу статьи 6 закона №23-ФЗ — об исключении соответствующего положения из статьи 32 закона №33-ФЗ — на 1 января 2028 года. Для обращений жителей используйте актуальный маршрут компетентного органа, а не старый шаблон.</p><div class="card-actions"><a class="btn primary" href="${CALENDAR_URL}">Разобрать даты и источники</a><a class="btn" href="https://publication.pravo.gov.ru/document/${FEDERAL_333_PUBLICATION}" target="_blank" rel="noopener noreferrer">333-ФЗ</a></div></div></article></div></section>`;

const HOUSING_CONTROL_MATRIX_ITEM = {
  id: 'municipal_housing_control_transition_2026_2028',
  question: 'Переход полномочий и регулирования муниципального жилищного контроля в 2026–2028 годах',
  level: 'federal',
  status: 'verified_current',
  basis_hint: 'Федеральный закон №23-ФЗ от 20.02.2026 в редакции Федерального закона №333-ФЗ от 04.08.2026',
  effective_from: '2026-09-01',
  transition_note: 'Основная часть 23-ФЗ вступила в силу 01.09.2026. Статья 6 23-ФЗ, исключающая подпункт «д» пункта 29 части 2 статьи 32 33-ФЗ, по действующей редакции вступает в силу 01.01.2028 после изменения срока Федеральным законом №333-ФЗ.',
  official_source_url: `https://publication.pravo.gov.ru/document/${FEDERAL_333_PUBLICATION}`,
  reference_source_url: 'https://www.consultant.ru/document/cons_doc_LAW_527040/',
  checked_at: '2026-09-11',
  checked_by: 'Редакционная сверка портала по официальным реквизитам 23-ФЗ и 333-ФЗ и действующей редакции 23-ФЗ',
  notes: 'Поправки относятся к компетенции органов публичной власти, а не к самостоятельным полномочиям ТОС. При жилищном обращении жителя необходимо проверять актуальный компетентный орган и предмет обращения.'
};

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing legal content file: ${relativePath}`);
  return { filePath, content: fs.readFileSync(filePath, 'utf8') };
}

function writeIfChanged(filePath, before, after, label) {
  if (after === before) return false;
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`Patched legal transition content: ${label}`);
  return true;
}

function fixPublicationNumber(relativePath) {
  const { filePath, content } = read(relativePath);
  const next = content.split(WRONG_85_PUBLICATION).join(CORRECT_85_PUBLICATION);
  return writeIfChanged(filePath, content, next, `${relativePath} source number`);
}

function insertBeforeMainEnd(relativePath, marker, section) {
  const { filePath, content } = read(relativePath);
  if (content.includes(marker) || content.includes(CALENDAR_URL)) return false;
  if (!content.includes('</main>')) throw new Error(`Cannot find </main> in ${relativePath}`);
  const next = content.replace('</main>', `${section}\n</main>`);
  return writeIfChanged(filePath, content, next, `${relativePath} calendar link`);
}

function insertBeforeMainEndByMarker(relativePath, marker, section) {
  const { filePath, content } = read(relativePath);
  if (content.includes(marker)) return false;
  if (!content.includes('</main>')) throw new Error(`Cannot find </main> in ${relativePath}`);
  const next = content.replace('</main>', `${section}\n</main>`);
  return writeIfChanged(filePath, content, next, `${relativePath} ${marker}`);
}

function insertBeforeAnchor(relativePath, marker, anchor, section) {
  const { filePath, content } = read(relativePath);
  if (content.includes(marker)) return false;
  if (!content.includes(anchor)) throw new Error(`Cannot find legal anchor in ${relativePath}`);
  const next = content.replace(anchor, `${section}\n${anchor}`);
  return writeIfChanged(filePath, content, next, `${relativePath} ${marker}`);
}

function upsertHousingControlMatrix() {
  const relativePath = 'data/legal_authority_matrix.json';
  const { filePath, content } = read(relativePath);
  const data = JSON.parse(content);
  if (!Array.isArray(data.items)) throw new Error(`${relativePath}: items must be an array`);
  const index = data.items.findIndex((item) => item && item.id === HOUSING_CONTROL_MATRIX_ITEM.id);
  if (index >= 0) data.items[index] = { ...data.items[index], ...HOUSING_CONTROL_MATRIX_ITEM };
  else data.items.splice(2, 0, HOUSING_CONTROL_MATRIX_ITEM);
  data.updated_at = '2026-09-11';
  const next = `${JSON.stringify(data, null, 2)}\n`;
  return writeIfChanged(filePath, content, next, `${relativePath} housing-control item`);
}

function patchLegalTransitionContent() {
  const sourceFiles = [
    'legal/federal-law-33/index.html',
    'legal/changes-2025-2026/index.html',
    'docs/LEGAL-CONTENT-UPDATE-2026-09-10.md'
  ];
  sourceFiles.forEach(fixPublicationNumber);

  insertBeforeMainEnd('legal/index.html', 'data-legal-transition-calendar', LEGAL_INDEX_SECTION);
  insertBeforeMainEnd('legal/changes-2025-2026/index.html', 'data-legal-transition-calendar', CHANGES_SECTION);
  insertBeforeMainEnd('legal/federal-law-33/index.html', 'data-legal-transition-calendar', FEDERAL_CALENDAR_CARD);

  insertBeforeAnchor(
    'legal/transition-calendar-2026-2028/index.html',
    HOUSING_CONTROL_MARKER,
    '  <section class="section"><div class="container prose"><h2>Что это означает именно для ТОС</h2>',
    HOUSING_CONTROL_SECTION
  );
  insertBeforeMainEndByMarker('legal/changes-2025-2026/index.html', HOUSING_CONTROL_MARKER, CHANGES_HOUSING_SECTION);
  upsertHousingControlMatrix();
}

if (require.main === module) patchLegalTransitionContent();

module.exports = {
  WRONG_85_PUBLICATION,
  CORRECT_85_PUBLICATION,
  FEDERAL_23_PUBLICATION,
  FEDERAL_333_PUBLICATION,
  CALENDAR_URL,
  HOUSING_CONTROL_MARKER,
  HOUSING_CONTROL_MATRIX_ITEM,
  patchLegalTransitionContent
};
