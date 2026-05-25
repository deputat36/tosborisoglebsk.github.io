const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function readJson(relativePath, fallback = []) {
  const file = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: JSON не читается — ${error.message}`);
    return fallback;
  }
}

function isDate(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function isUrl(value) {
  if (!value) return true;
  return /^https?:\/\//.test(String(value));
}

function uniqueBy(items, field, label) {
  const seen = new Set();
  for (const item of items) {
    const value = item[field];
    if (!value) continue;
    if (seen.has(value)) errors.push(`${label}: дублируется ${field}=${value}`);
    seen.add(value);
  }
}

function validateToses(toses) {
  uniqueBy(toses, 'slug', 'data/toses.json');
  for (const tos of toses) {
    const name = tos.name || tos.slug || 'без названия';
    ['slug', 'name', 'type', 'location', 'boundaries', 'chairperson'].forEach((field) => {
      if (!tos[field]) warnings.push(`ТОС ${name}: не заполнено поле ${field}`);
    });
    if (!isDate(tos.updated_at)) errors.push(`ТОС ${name}: updated_at должен быть YYYY-MM-DD`);
    [...(tos.chairperson_links || []), ...(tos.social_links || [])].forEach((url) => {
      if (!isUrl(url)) errors.push(`ТОС ${name}: некорректная ссылка ${url}`);
    });
  }
}

function validateCollection(items, file, idField = 'id') {
  uniqueBy(items, idField, file);
  for (const item of items) {
    const id = item[idField] || item.title || 'без id';
    if (!item[idField]) errors.push(`${file}: запись без ${idField}`);
    if (!item.title) warnings.push(`${file}: ${id} — нет title`);
    if (item.date && !isDate(item.date)) errors.push(`${file}: ${id} — date должен быть YYYY-MM-DD`);
    if (item.source_url && !isUrl(item.source_url)) errors.push(`${file}: ${id} — некорректный source_url`);
  }
}

function validateTosLinks(items, file, slugs) {
  for (const item of items) {
    if (item.tos_slug && !slugs.has(item.tos_slug)) {
      errors.push(`${file}: ${item.id || item.title || 'запись'} — tos_slug=${item.tos_slug} не найден в data/toses.json`);
    }
  }
}

function main() {
  const toses = readJson('data/toses.json');
  const news = readJson('data/news.json');
  const articles = readJson('data/articles.json');
  const projects = readJson('data/projects.json');
  const events = readJson('data/events.json');
  const needs = readJson('data/needs.json');
  const docs = readJson('data/documents.json');
  const grants = readJson('data/grants.json');

  validateToses(toses);
  validateCollection(news, 'data/news.json');
  validateCollection(articles, 'data/articles.json');
  validateCollection(projects, 'data/projects.json');
  validateCollection(events, 'data/events.json');
  validateCollection(needs, 'data/needs.json');
  validateCollection(docs, 'data/documents.json');
  validateCollection(grants, 'data/grants.json');

  const slugs = new Set(toses.map((tos) => tos.slug).filter(Boolean));
  validateTosLinks(news, 'data/news.json', slugs);
  validateTosLinks(projects, 'data/projects.json', slugs);
  validateTosLinks(events, 'data/events.json', slugs);
  validateTosLinks(needs, 'data/needs.json', slugs);

  if (warnings.length) {
    console.warn('Предупреждения:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('Ошибки данных:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('JSON-данные прошли базовую проверку.');
}

main();
