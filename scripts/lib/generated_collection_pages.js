const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const GENERATED_COLLECTIONS = [
  {
    name: 'tos',
    route: '/tos/',
    dataPath: path.join(ROOT, 'data', 'toses.json'),
    dataKey: 'slug',
    rootDir: path.join(ROOT, 'tos'),
    marker: 'Данные страницы обновляются автоматически из JSON-файлов сайта.'
  },
  {
    name: 'materials',
    route: '/materials/',
    dataPath: path.join(ROOT, 'data', 'articles.json'),
    dataKey: 'id',
    rootDir: path.join(ROOT, 'materials'),
    marker: 'Страница материала создана автоматически из data/articles.json.'
  },
  {
    name: 'news',
    route: '/news/',
    dataPath: path.join(ROOT, 'data', 'news.json'),
    dataKey: 'id',
    rootDir: path.join(ROOT, 'news'),
    marker: 'Страница новости создана автоматически из data/news.json.'
  },
  {
    name: 'done',
    route: '/done/',
    dataPath: path.join(ROOT, 'data', 'done.json'),
    dataKey: 'id',
    rootDir: path.join(ROOT, 'done'),
    marker: 'Страница истории результата создана автоматически из data/done.json.'
  },
  {
    name: 'needs',
    route: '/needs/',
    dataPath: path.join(ROOT, 'data', 'needs.json'),
    dataKey: 'id',
    rootDir: path.join(ROOT, 'needs'),
    marker: 'Страница потребности создана автоматически из data/needs.json.'
  }
];

function readPublishedIds(collection) {
  if (!collection || !collection.dataPath || !collection.dataKey) {
    throw new Error('Invalid generated collection configuration');
  }
  if (!fs.existsSync(collection.dataPath)) {
    throw new Error(`Missing data file: ${path.relative(ROOT, collection.dataPath)}`);
  }

  const items = JSON.parse(fs.readFileSync(collection.dataPath, 'utf8'));
  if (!Array.isArray(items)) {
    throw new Error(`Expected array in ${path.relative(ROOT, collection.dataPath)}`);
  }

  return items
    .filter((item) => item && item[collection.dataKey] && item.status !== 'draft')
    .map((item) => String(item[collection.dataKey]).trim())
    .filter(Boolean);
}

module.exports = {
  GENERATED_COLLECTIONS,
  readPublishedIds
};
