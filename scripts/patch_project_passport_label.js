const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'generate_page_index.js');
let text = fs.readFileSync(file, 'utf8');

if (!text.includes("'project-passport':")) {
  const marker = "workbench: 'Рабочая панель',";
  if (!text.includes(marker)) throw new Error('Marker not found');
  text = text.replace(marker, `${marker}\n    'project-passport': 'Паспорт проекта ТОС',`);
  fs.writeFileSync(file, text, 'utf8');
}

console.log('Project passport label is ready.');
