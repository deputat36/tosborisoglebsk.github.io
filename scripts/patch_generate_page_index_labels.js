const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'generate_page_index.js');
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  "calendar: 'Календарь', contacts: 'Контакты', search: 'Поиск'",
  "calendar: 'Календарь', contacts: 'Контакты', search: 'Поиск', sources: 'Источники данных', privacy: 'Публикация сведений', glossary: 'Словарь', methodology: 'О портале', 'data-quality': 'Качество данных', 'data-update': 'Актуализация данных', 'check-tos': 'Проверка ТОС'"
);

fs.writeFileSync(file, src, 'utf8');
console.log('generate_page_index.js labels patched.');
