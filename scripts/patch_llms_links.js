const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'llms.txt');

const methodLinks = [
  ['Проверить карточку ТОС', 'https://tosborisoglebsk.ru/check-tos/'],
  ['Памятка подтверждения карточки', 'https://tosborisoglebsk.ru/chairperson/verify-card/'],
  ['Статусы проверки данных', 'https://tosborisoglebsk.ru/verification-levels/'],
  ['Качество данных', 'https://tosborisoglebsk.ru/data-quality/'],
  ['Коммуникационный набор', 'https://tosborisoglebsk.ru/communication-kit/'],
  ['Кампания актуализации данных', 'https://tosborisoglebsk.ru/campaign/'],
  ['Чек-лист проверки карточки', 'https://tosborisoglebsk.ru/field-checklist/'],
  ['Фото и логотипы для карточек', 'https://tosborisoglebsk.ru/media-guide/'],
  ['Методика развития портала', 'https://tosborisoglebsk.ru/methodology/'],
  ['Открытые данные', 'https://tosborisoglebsk.ru/open-data/'],
  ['План развития', 'https://tosborisoglebsk.ru/roadmap/'],
  ['Прислать материал', 'https://tosborisoglebsk.ru/submit-materials/'],
  ['Индекс страниц', 'https://tosborisoglebsk.ru/site-index/'],
  ['Редакционная политика', 'https://tosborisoglebsk.ru/editorial-policy/'],
  ['Источники данных', 'https://tosborisoglebsk.ru/sources/'],
  ['Справочник полей данных', 'https://tosborisoglebsk.ru/data-dictionary/']
];

const dataLinks = [
  ['Каталог ТОС', 'https://tosborisoglebsk.ru/data/toses.json'],
  ['Новости', 'https://tosborisoglebsk.ru/data/news.json'],
  ['Проекты', 'https://tosborisoglebsk.ru/data/projects.json'],
  ['Потребности', 'https://tosborisoglebsk.ru/data/needs.json'],
  ['Сделано', 'https://tosborisoglebsk.ru/data/done.json'],
  ['События', 'https://tosborisoglebsk.ru/data/events.json'],
  ['Документы', 'https://tosborisoglebsk.ru/data/documents.json'],
  ['Аудит качества карточек', 'https://tosborisoglebsk.ru/data/tos_content_audit.json'],
  ['Индекс страниц', 'https://tosborisoglebsk.ru/data/page_index.json'],
  ['RSS', 'https://tosborisoglebsk.ru/rss.xml'],
  ['Sitemap', 'https://tosborisoglebsk.ru/sitemap.xml']
];

const deprecatedUrls = [
  'https://tosborisoglebsk.ru/site-health/',
  'https://tosborisoglebsk.ru/data-requests/',
  'https://tosborisoglebsk.ru/verification-tasks/',
  'https://tosborisoglebsk.ru/publication-templates/',
  'https://tosborisoglebsk.ru/weekly-digest/',
  'https://tosborisoglebsk.ru/meeting-kit/',
  'https://tosborisoglebsk.ru/project-passport/',
  'https://tosborisoglebsk.ru/grant-application-kit/',
  'https://tosborisoglebsk.ru/partner-proposal/',
  'https://tosborisoglebsk.ru/partner-thanks/',
  'https://tosborisoglebsk.ru/data/site_health.json',
  'https://tosborisoglebsk.ru/data/verification_tasks.csv',
  'https://tosborisoglebsk.ru/data/collection_tasks.csv'
];

function removeDeprecatedLinks(text) {
  return text
    .split('\n')
    .filter((line) => !deprecatedUrls.some((url) => line.includes(url)))
    .join('\n');
}

function ensureSection(text, sectionHeader, beforeHeader) {
  if (text.includes(sectionHeader)) return text;
  const beforeIndex = beforeHeader ? text.indexOf(beforeHeader) : -1;
  if (beforeIndex !== -1) {
    return `${text.slice(0, beforeIndex).trim()}\n\n${sectionHeader}\n\n${text.slice(beforeIndex).trimStart()}`;
  }
  return `${text.trim()}\n\n${sectionHeader}\n`;
}

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

  text = removeDeprecatedLinks(text);
  text = ensureSection(text, '## Публичные методические разделы', '## Открытые данные');
  text = ensureSection(text, '## Открытые данные', '## Рабочие страницы');

  for (const [title, url] of methodLinks) {
    text = ensureLink(text, title, url, '## Публичные методические разделы', '## Открытые данные');
  }

  for (const [title, url] of dataLinks) {
    text = ensureLink(text, title, url, '## Открытые данные', '## Рабочие страницы');
  }

  fs.writeFileSync(FILE, `${text.trim()}\n`, 'utf8');
  console.log('Patched llms.txt public links.');
}

main();
