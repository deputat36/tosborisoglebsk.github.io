const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'scripts', 'generate_page_index.js');

const labels = {
  'verification-tasks': 'Задачи проверки карточек ТОС',
  'improvement-plan': 'План улучшения портала',
  'site-health': 'Аудит сайта',
  'grant-application-kit': 'Набор для подготовки заявки ТОС',
  'meeting-kit': 'Набор для собрания ТОС',
  'publication-templates': 'Шаблоны публикаций',
  'weekly-digest': 'Еженедельный дайджест',
  'partner-proposal': 'Партнёрское предложение',
  'partner-thanks': 'Благодарности партнёрам',
  'data-dictionary': 'Справочник полей данных',
  'verification-levels': 'Статусы проверки данных',
  'collection-board': 'Доска сбора данных',
  'editorial-workflow': 'Редакционный порядок',
  'content-standards': 'Стандарты материалов'
};

let js = fs.readFileSync(FILE, 'utf8');

for (const [key, value] of Object.entries(labels)) {
  if (js.includes(`'${key}':`)) continue;
  const marker = "workbench: 'Рабочая панель',";
  if (!js.includes(marker)) throw new Error(`Не найден маркер для добавления ${key}`);
  js = js.replace(marker, `${marker}\n    '${key}': '${value}',`);
}

fs.writeFileSync(FILE, js, 'utf8');
console.log('Patched page index section labels.');
