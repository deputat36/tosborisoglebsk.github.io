const fs = require('fs');
const path = require('path');
const { findStaleGeneratedDirectories } = require('./lib/generated_page_cleanup');

const ROOT = process.cwd();

const collections = [
  {
    name: 'tos',
    dataPath: path.join(ROOT, 'data', 'toses.json'),
    dataKey: 'slug',
    rootDir: path.join(ROOT, 'tos'),
    marker: 'Данные страницы обновляются автоматически из JSON-файлов сайта.'
  },
  {
    name: 'materials',
    dataPath: path.join(ROOT, 'data', 'articles.json'),
    rootDir: path.join(ROOT, 'materials'),
    marker: 'Страница материала создана автоматически из data/articles.json.'
  },
  {
    name: 'news',
    dataPath: path.join(ROOT, 'data', 'news.json'),
    rootDir: path.join(ROOT, 'news'),
    marker: 'Страница новости создана автоматически из data/news.json.'
  },
  {
    name: 'done',
    dataPath: path.join(ROOT, 'data', 'done.json'),
    rootDir: path.join(ROOT, 'done'),
    marker: 'Страница истории результата создана автоматически из data/done.json.'
  },
  {
    name: 'needs',
    dataPath: path.join(ROOT, 'data', 'needs.json'),
    rootDir: path.join(ROOT, 'needs'),
    marker: 'Страница потребности создана автоматически из data/needs.json.'
  }
];

function readPublishedIds(file, dataKey = 'id') {
  if (!fs.existsSync(file)) throw new Error(`Missing data file: ${file}`);
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) throw new Error(`Expected array in ${file}`);
  return items
    .filter((item) => item && item[dataKey] && item.status !== 'draft')
    .map((item) => item[dataKey]);
}

function main() {
  const errors = [];

  for (const collection of collections) {
    const validIds = readPublishedIds(collection.dataPath, collection.dataKey);
    const stale = findStaleGeneratedDirectories({
      rootDir: collection.rootDir,
      validIds,
      marker: collection.marker
    });

    stale.forEach((entry) => {
      errors.push(`${collection.name}: stale generated page /${collection.name}/${entry.id}/`);
    });
  }

  if (errors.length) {
    throw new Error(`Generated collection page cleanup audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Generated collection pages OK: ${collections.length} collections`);
}

main();
