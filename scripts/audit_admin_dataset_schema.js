const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];

const datasets = [
  { section: 'toses', file: 'data/toses.json', keys: ['slug'], label: 'name', relation: false, source: 'core' },
  { section: 'news', file: 'data/news.json', keys: ['id'], label: 'title', relation: true, source: 'core' },
  { section: 'articles', file: 'data/articles.json', keys: ['id'], label: 'title', relation: false, source: 'core' },
  { section: 'documents', file: 'data/documents.json', keys: ['title'], label: 'title', relation: false, source: 'core' },
  { section: 'grants', file: 'data/grants.json', keys: ['id','title'], label: 'title', relation: false, source: 'core' },
  { section: 'projects', file: 'data/projects.json', keys: ['id'], label: 'title', relation: true, source: 'core' },
  { section: 'done', file: 'data/done.json', keys: ['id'], label: 'title', relation: true, source: 'dashboard' },
  { section: 'events', file: 'data/events.json', keys: ['id'], label: 'title', relation: true, source: 'core' },
  { section: 'needs', file: 'data/needs.json', keys: ['id'], label: 'title', relation: true, source: 'core' }
];

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readArray(relativePath) {
  const text = read(relativePath);
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) {
      errors.push(`${relativePath} must contain an array`);
      return [];
    }
    return value;
  } catch (error) {
    errors.push(`${relativePath} is invalid JSON: ${error.message}`);
    return [];
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasDatasetDefinition(text, section, file) {
  const sectionPattern = section === 'done'
    ? `DATASETS\\.${escapeRegExp(section)}\\s*=\\s*\\{`
    : `${escapeRegExp(section)}\\s*:\\s*\\{`;
  const filePattern = `file\\s*:\\s*['\"]/${escapeRegExp(file)}['\"]`;
  return new RegExp(`${sectionPattern}[\\s\\S]{0,4500}?${filePattern}`).test(text);
}

const indexHtml = read('admin/index.html');
const core = read('admin/admin2.js');
const dashboard = read('admin/admin-dashboard.js');
const documentation = read('docs/ADMIN-DATASETS-2026-07-13.md');
const toses = readArray('data/toses.json');
const knownSlugs = new Set(toses.map((item) => String(item?.slug || '').trim()).filter(Boolean));
let totalRecords = 0;

const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
const expectedScripts = [
  '/admin/admin2.js',
  '/admin/admin-logo-tools.js',
  '/admin/admin-dashboard.js',
  '/admin/admin-export-tools.js',
  '/admin/admin-history.js'
];
if (scripts.join('|') !== expectedScripts.join('|')) errors.push(`unexpected admin scripts: ${scripts.join(', ')}`);

for (const dataset of datasets) {
  const source = dataset.source === 'dashboard' ? dashboard : core;
  if (!hasDatasetDefinition(source, dataset.section, dataset.file)) {
    errors.push(`admin schema missing ${dataset.section} -> /${dataset.file}`);
  }
  if (!dashboard.includes(`readDataset('${dataset.section}')`)) {
    errors.push(`dashboard does not load ${dataset.section}`);
  }

  const records = dataset.section === 'toses' ? toses : readArray(dataset.file);
  totalRecords += records.length;
  const identifiers = new Set();

  records.forEach((record, index) => {
    const context = `${dataset.file}[${index}]`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${context} must be an object`);
      return;
    }

    const identifier = dataset.keys
      .map((key) => String(record[key] || '').trim())
      .find(Boolean) || '';
    if (!identifier) errors.push(`${context} has no identifier from ${dataset.keys.join('|')}`);
    if (identifier && identifiers.has(identifier)) errors.push(`${context} duplicates identifier ${identifier}`);
    if (identifier) identifiers.add(identifier);

    if (!(dataset.label in record) || !String(record[dataset.label] || '').trim()) {
      errors.push(`${context} has no ${dataset.label}`);
    }

    if (dataset.relation) {
      const slug = String(record.tos_slug || '').trim();
      if (slug && !knownSlugs.has(slug)) errors.push(`${context} references unknown tos_slug ${slug}`);
    }
  });
}

[
  "DATASETS.done = {",
  "file: '/data/done.json'",
  "download: 'done.json'",
  "status: 'draft'",
  "content_origin: 'editorial'",
  "['id','ID']",
  "['tos_slug','Привязка к ТОС: slug','tosSlug']",
  "['summary','Краткое описание','textarea']",
  "['before','Что было до работ','textarea']",
  "['done','Что выполнено','textarea']",
  "['result','Итог для территории','textarea']",
  "['participants','Участники','textarea']",
  "['source_label','Название источника']",
  "['source_url','Ссылка на источник']",
  "['needs_details','Каких подтверждений не хватает','textarea']",
  "select:verified|editorial|starter|request",
  "data-section=\"done\"",
  "<code>data/done.json</code>",
  'doneNeedsEvidence',
  "readDataset('done')",
  "linkedCount(done)"
].forEach((token) => {
  if (!dashboard.includes(token)) errors.push(`done admin extension missing ${token}`);
});

const doneRecords = readArray('data/done.json');
const allowedOrigins = new Set(['verified','editorial','starter','request']);
doneRecords.forEach((record, index) => {
  const origin = String(record?.content_origin || '').trim();
  if (!allowedOrigins.has(origin)) errors.push(`data/done.json[${index}] has invalid content_origin ${origin}`);
});

[
  'девять публичных JSON-коллекций',
  '`data/done.json` — результаты проектов',
  'Новая запись создаётся как `draft`',
  '`content_origin=editorial`',
  'не меняет содержимое JSON-файлов',
  'Audit admin dataset schemas'
].forEach((token) => {
  if (!documentation.includes(token)) errors.push(`dataset documentation missing ${token}`);
});

if (errors.length) {
  throw new Error(`Admin dataset schema audit failed:\n${errors.join('\n')}`);
}

console.log(`Admin dataset schema audit OK: ${datasets.length} collections, ${totalRecords} records, relations valid`);
