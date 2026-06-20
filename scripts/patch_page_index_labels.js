const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'scripts', 'generate_page_index.js');

const labels = {
  'verification-guide': 'Как подтвердить карточку ТОС',
  'verification-levels': 'Статусы проверки данных',
  'data-dictionary': 'Справочник полей данных',
  'editorial-workflow': 'Редакционный порядок',
  'content-standards': 'Стандарты материалов'
};

const deprecatedLabels = [
  'verification-control',
  'verification-tasks',
  'improvement-plan',
  'site-health',
  'grant-application-kit',
  'meeting-kit',
  'publication-templates',
  'weekly-digest',
  'partner-proposal',
  'partner-thanks',
  'collection-board'
];

function removeDeprecatedLabel(source, key) {
  const linePattern = new RegExp(`\\n\\s+'${key}': '[^']+',`, 'g');
  return source.replace(linePattern, '');
}

let js = fs.readFileSync(FILE, 'utf8');

for (const key of deprecatedLabels) {
  js = removeDeprecatedLabel(js, key);
}

for (const [key, value] of Object.entries(labels)) {
  if (js.includes(`'${key}':`)) continue;
  const marker = "workbench: 'Рабочая панель',";
  if (!js.includes(marker)) throw new Error(`Не найден маркер для добавления ${key}`);
  js = js.replace(marker, `${marker}\n    '${key}': '${value}',`);
}

fs.writeFileSync(FILE, js, 'utf8');
console.log('Patched public page index section labels.');
