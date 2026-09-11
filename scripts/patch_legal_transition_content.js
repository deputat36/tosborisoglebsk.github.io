const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WRONG_85_PUBLICATION = '0001202604090023';
const CORRECT_85_PUBLICATION = '0001202604090002';
const CALENDAR_URL = '/legal/transition-calendar-2026-2028/';

const LEGAL_INDEX_SECTION = `
<section class="section" data-legal-transition-calendar><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag warn">Контрольные даты</span><h2>Переход от 131-ФЗ к 33-ФЗ: что проверить в 2026–2028 годах</h2><p>Муниципальные правовые акты по вопросам организации местного самоуправления должны быть приведены в соответствие с 33-ФЗ не позднее 1 января 2027 года. Основной переходный срок и прекращение действия 131-ФЗ перенесены на 1 января 2028 года.</p><div class="card-actions"><a class="btn primary" href="${CALENDAR_URL}">Открыть правовой календарь</a><a class="btn" href="/legal/changes-2025-2026/">Изменения для БГО</a></div></div></article></div></section>`;

const CHANGES_SECTION = `
  <section class="section" data-legal-transition-calendar><div class="container section-head"><div><h2>Контрольные даты переходного периода</h2><p>Почему 1 января 2027 и 1 января 2028 означают разные юридические этапы</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag warn">01.01.2027</span><h3>Муниципальные акты должны быть приведены в соответствие</h3><p>Часть 2 статьи 91 33-ФЗ устанавливает этот срок для региональных и муниципальных правовых актов по вопросам организации местного самоуправления.</p></div></article><article class="card"><div class="card-inner"><span class="tag">01.01.2028</span><h3>Завершается основной переходный период</h3><p>До этой даты действует переходная конструкция статьи 91, а с этой даты 131-ФЗ признаётся утратившим силу в соответствии со статьёй 93.</p></div></article><article class="card"><div class="card-inner"><span class="tag ok">Практика</span><h3>Старый шаблон нельзя применять автоматически</h3><p>Проверяйте конкретный предмет регулирования, дату муниципального акта и зарегистрированный устав своего ТОС.</p><a class="btn" href="${CALENDAR_URL}">Подробный календарь</a></div></article></div></section>`;

const FEDERAL_CALENDAR_CARD = `
  <section class="section" data-legal-transition-calendar><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag warn">Переходный период</span><h2>Две даты, которые нельзя путать</h2><p><b>1 января 2027 года</b> — предельный срок приведения региональных и муниципальных правовых актов в соответствие с 33-ФЗ. <b>1 января 2028 года</b> — завершение основной переходной конструкции и дата, с которой 131-ФЗ признаётся утратившим силу.</p><a class="btn primary" href="${CALENDAR_URL}">Открыть правовой календарь 2026–2028</a></div></article></div></section>`;

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
}

if (require.main === module) patchLegalTransitionContent();

module.exports = {
  WRONG_85_PUBLICATION,
  CORRECT_85_PUBLICATION,
  CALENDAR_URL,
  patchLegalTransitionContent
};
