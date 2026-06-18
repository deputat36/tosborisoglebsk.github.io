const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'llms.txt');

const mainLinks = [
  ['Аудит сайта', 'https://tosborisoglebsk.ru/site-health/'],
  ['План улучшения портала', 'https://tosborisoglebsk.ru/improvement-plan/'],
  ['Задачи проверки карточек ТОС', 'https://tosborisoglebsk.ru/verification-tasks/'],
  ['Шаблоны публикаций', 'https://tosborisoglebsk.ru/publication-templates/'],
  ['Еженедельный дайджест', 'https://tosborisoglebsk.ru/weekly-digest/'],
  ['Набор для собрания ТОС', 'https://tosborisoglebsk.ru/meeting-kit/'],
  ['Паспорт проекта ТОС', 'https://tosborisoglebsk.ru/project-passport/'],
  ['Набор для подготовки заявки ТОС', 'https://tosborisoglebsk.ru/grant-application-kit/'],
  ['Партнёрское предложение', 'https://tosborisoglebsk.ru/partner-proposal/'],
  ['Благодарности партнёрам', 'https://tosborisoglebsk.ru/partner-thanks/']
];

const dataLinks = [
  ['Здоровье сайта', 'https://tosborisoglebsk.ru/data/site_health.json'],
  ['Задачи проверки карточек', 'https://tosborisoglebsk.ru/data/verification_tasks.csv'],
  ['Задачи сбора данных', 'https://tosborisoglebsk.ru/data/collection_tasks.csv']
];

function ensureLink(text, title, url, sectionHeader, fallbackMarker) {
  if (text.includes(url)) return text;
  const line = `- ${title}: ${url}`;
  const sectionIndex = text.indexOf(sectionHeader);
  if (sectionIndex === -1) return `${text.trim()}\n${line}\n`;
  const markerIndex = text.indexOf(fallbackMarker, sectionIndex);
  if (markerIndex !== -1) {
    return `${text.slice(0, markerIndex)}${line}\n${text.slice(markerIndex)}`;
  }
  return `${text.trim()}\n${line}\n`;
}

function main() {
  if (!fs.existsSync(FILE)) throw new Error('llms.txt not found');
  let text = fs.readFileSync(FILE, 'utf8');

  for (const [title, url] of mainLinks) {
    text = ensureLink(text, title, url, '## Основные разделы', '- Источники данных:');
  }

  for (const [title, url] of dataLinks) {
    text = ensureLink(text, title, url, '## Открытые данные', '- RSS:');
  }

  fs.writeFileSync(FILE, `${text.trim()}\n`, 'utf8');
  console.log('Patched llms.txt links.');
}

main();
