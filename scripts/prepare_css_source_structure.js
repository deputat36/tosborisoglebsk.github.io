const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, 'assets', 'css', 'styles.css');
const OUTPUT_PATH = path.resolve(
  ROOT,
  process.env.CSS_STRUCTURE_PRETTIER_INPUT || '.artifacts/css-source-structure/styles.with-sections.css'
);

const SECTIONS = [
  { pattern: /:root\s*\{/, title: '01. Переменные и темы' },
  { pattern: /\*\s*\{/, title: '02. Базовые стили и доступность' },
  { pattern: /\.header\s*\{/, title: '03. Шапка и навигация' },
  { pattern: /\.btn\s*\{/, title: '04. Кнопки и группы действий' },
  { pattern: /\.hero\s*\{/, title: '05. Hero-блоки' },
  { pattern: /\.section\s*\{/, title: '06. Секции, сетки и карточки' },
  { pattern: /\.toolbar\s*\{/, title: '07. Формы, фильтры и элементы ТОС' },
  { pattern: /\.prose\s*\{/, title: '08. Текст, уведомления и таблицы' },
  { pattern: /\.footer\s*\{/, title: '09. Футер и вспомогательные списки' },
  { pattern: /\.stats-grid\s*\{/, title: '10. Статистика и KPI' },
  { pattern: /\.home-panel\s*\{/, title: '11. Специальные блоки главной' },
  { pattern: /@media\s*\(\s*max-width\s*:\s*900px\s*\)\s*\{/, title: '12. Адаптивные правила' },
  { pattern: /\.quick-list\s*\{/, title: '13. Дополнительные компоненты' },
  { pattern: /\.print-only\s*\{/, title: '14. Печать' }
];

function insertSection(source, pattern, title) {
  const marker = `/* ${title} */`;
  if (source.includes(marker)) return source;

  const match = source.match(pattern);
  if (!match || typeof match.index !== 'number') {
    throw new Error(`Missing CSS section anchor for ${title}: ${pattern}`);
  }

  return `${source.slice(0, match.index)}\n\n${marker}\n${source.slice(match.index)}`;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error('Missing assets/css/styles.css');
  }

  let css = fs.readFileSync(INPUT_PATH, 'utf8').trim();
  for (const section of SECTIONS) {
    css = insertSection(css, section.pattern, section.title);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${css.trim()}\n`, 'utf8');
  console.log(`Prepared CSS source structure: ${path.relative(ROOT, OUTPUT_PATH)} (${SECTIONS.length} sections)`);
}

main();
