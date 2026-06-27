const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'news', 'index.html');
const scriptPath = path.join(process.cwd(), 'assets', 'js', 'news.js');
const newsPath = path.join(process.cwd(), 'data', 'news.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');

const requiredControls = ['verified-news', 'news-feed', 'send-news', 'news-search', 'news-category-filter', 'news-tos-filter'];
const requiredCopy = [
  'Живая лента ТОСов Борисоглебского округа',
  'Редакционный принцип',
  'Типы публикаций',
  'Все новости',
  'Какой должна быть хорошая новость ТОС',
  'Прислать новость ТОС',
  'Можно ли публиковать имена и контакты'
];
const requiredRoutes = ['/news/', '/project-check-2026/', '/tos/mirolyubie/', '/content-intake/', '/contacts/', '/done/'];
const requiredDataFetches = ['/data/news.json', '/data/toses.json'];
const requiredCategories = ['Портал', 'Инструкция', 'Конкурсы', 'Гранты', 'Правовая база'];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function main() {
  const errors = [];

  [pagePath, scriptPath, newsPath, tosesPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`News page content audit failed:\n${errors.join('\n')}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const publishedNews = Array.isArray(news) ? news.filter((item) => item && item.status !== 'draft') : [];
  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);

  if (!title.includes('Новости ТОС БГО') || !title.includes('фотоотчёты')) {
    errors.push('news page title must identify news and photo reports');
  }

  if (description.length < 110 || !description.includes('подтверждённые результаты') || !description.includes('полезные материалы')) {
    errors.push('news page description must cover verified results and useful materials');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/news/"')) {
    errors.push('missing canonical link for news page');
  }

  if (!html.includes('<meta property="og:url" content="https://tosborisoglebsk.ru/news/"')) {
    errors.push('missing Open Graph URL for news page');
  }

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing news page control #${id}`);
  });

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) errors.push(`news page is missing copy: ${copy}`);
  });

  requiredRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`linked route does not exist: ${route}`);
    if (!html.includes(`href="${route}`)) errors.push(`news page does not link to ${route}`);
  });

  requiredDataFetches.forEach((dataPath) => {
    if (!repoPathExists(dataPath)) errors.push(`news data dependency is missing: ${dataPath}`);
    if (!script.includes(`fetch('${dataPath}'`)) errors.push(`news script does not fetch ${dataPath}`);
  });

  if (!html.includes('/assets/js/news.js')) {
    errors.push('news page must include assets/js/news.js');
  }

  if (!html.includes('https://vk.ru/tosbgo')) {
    errors.push('news page must link to VK community');
  }

  if (!html.includes('1 489 360') || !html.includes('ТОС «Миролюбие»')) {
    errors.push('verified featured news block must preserve the confirmed Mirlyubie grant result');
  }

  if (!html.includes('Начало, ход и завершение работ будут указаны только после отдельного подтверждения ТОС')) {
    errors.push('verified news block must not imply project implementation without confirmation');
  }

  if (!Array.isArray(news) || publishedNews.length < 10) {
    errors.push('data/news.json must contain at least 10 published news items');
  }

  requiredCategories.forEach((category) => {
    if (!publishedNews.some((item) => item.category === category)) {
      errors.push(`news category is missing in data/news.json: ${category}`);
    }
  });

  publishedNews.forEach((item, index) => {
    const line = `news item ${index + 1} ${item.id || 'unknown'}`;
    if (!item.id) errors.push(`${line}: missing id`);
    if (!item.date) errors.push(`${line}: missing date`);
    if (!item.category) errors.push(`${line}: missing category`);
    if (!item.title) errors.push(`${line}: missing title`);
    if (!item.lead) errors.push(`${line}: missing lead`);
    if (!Array.isArray(item.text) || !item.text.length) errors.push(`${line}: missing text array`);
    if (item.tos_slug && !tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
  });

  if (!script.includes('newsEsc') || !script.includes('replace(/[&<>')) {
    errors.push('news script must escape HTML-sensitive characters');
  }

  if (!script.includes("replace(/ё/g, 'е')")) {
    errors.push('news script must normalize ё in search queries');
  }

  if (!script.includes('news.filter(newsPublished)')) {
    errors.push('news script must hide draft news');
  }

  if (!script.includes('localeCompare(String(a.date')) {
    errors.push('news script must sort news by date descending');
  }

  if (!script.includes('/news/${newsEsc(item.id)}/')) {
    errors.push('news cards must link to detail pages');
  }

  if (!script.includes('/tos/${newsEsc(item.tos_slug)}/')) {
    errors.push('news cards must link to related TOS cards');
  }

  if (!script.includes('target="_blank" rel="noopener"')) {
    errors.push('news source links must open safely');
  }

  if (!html.includes('data-action="menu"') || !html.includes('data-action="theme"')) {
    errors.push('news page must keep menu and theme controls');
  }

  if (errors.length) {
    throw new Error(`News page content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`News page content OK: ${publishedNews.length} published items`);
}

main();
