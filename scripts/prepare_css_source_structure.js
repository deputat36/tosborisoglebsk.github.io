const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, 'assets', 'css', 'styles.css');
const OUTPUT_PATH = path.resolve(
  ROOT,
  process.env.CSS_STRUCTURE_PRETTIER_INPUT || '.artifacts/css-source-structure/styles.with-sections.css'
);

const SECTIONS = [
  [':root{', '01. Переменные и темы'],
  ['*{', '02. Базовые стили и доступность'],
  ['.header{', '03. Шапка и навигация'],
  ['.btn{', '04. Кнопки и группы действий'],
  ['.hero{', '05. Hero-блоки'],
  ['.section{', '06. Секции, сетки и карточки'],
  ['.toolbar{', '07. Формы, фильтры и элементы ТОС'],
  ['.prose{', '08. Текст, уведомления и таблицы'],
  ['.footer{', '09. Футер и вспомогательные списки'],
  ['.stats-grid{', '10. Статистика и KPI'],
  ['.home-panel{', '11. Специальные блоки главной'],
  ['@media(max-width:900px){', '12. Адаптивные правила'],
  ['.quick-list{', '13. Дополнительные компоненты'],
  ['.print-only{', '14. Печать']
];

function insertSection(source, marker, title) {
  const occurrences = source.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one marker ${marker}, found ${occurrences}`);
  }
  return source.replace(marker, `\n\n/* ${title} */\n${marker}`);
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error('Missing assets/css/styles.css');
  }

  let css = fs.readFileSync(INPUT_PATH, 'utf8').trim();
  for (const [marker, title] of SECTIONS) {
    css = insertSection(css, marker, title);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${css.trim()}\n`, 'utf8');
  console.log(`Prepared CSS source structure: ${path.relative(ROOT, OUTPUT_PATH)} (${SECTIONS.length} sections)`);
}

main();
