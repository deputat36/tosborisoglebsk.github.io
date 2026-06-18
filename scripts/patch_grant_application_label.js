const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'generate_page_index.js');
let text = fs.readFileSync(file, 'utf8');

if (!text.includes("'grant-application-kit':")) {
  const marker = "workbench: 'Рабочая панель',";
  if (!text.includes(marker)) throw new Error('Marker not found');
  text = text.replace(marker, `${marker}\n    'grant-application-kit': 'Набор для подготовки заявки ТОС',`);
  fs.writeFileSync(file, text, 'utf8');
}

console.log('Grant application kit label is ready.');
