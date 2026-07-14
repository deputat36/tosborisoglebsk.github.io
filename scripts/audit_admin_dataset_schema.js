const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'admin', 'index.html');
const CORE_PATH = path.join(ROOT, 'admin', 'admin2.js');
const DONE_PATH = path.join(ROOT, 'admin', 'admin-done-dataset.js');
const DASHBOARD_PATH = path.join(ROOT, 'admin', 'admin-dashboard.js');

const datasets = [
  { section: 'toses', file: 'data/toses.json', key: 'slug', label: 'name', relation: false, source: 'core' },
  { section: 'news', file: 'data/news.json', key: 'id', label: 'title', relation: true, source: 'core' },
  { section: 'articles', file: 'data/articles.json', key: 'id', label: 'title', relation: false, source: 'core' },
  { section: 'documents', file: 'data/documents.json', key: 'title', label: 'title', relation: false, source: 'core' },
  { section: 'grants', file: 'data/grants.json', key: 'id', label: 'title', relation: false, source: 'core' },
  { section: 'projects', file: 'data/projects.json', key: 'id', label: 'title', relation: true, source: 'core' },
  { section: 'done', file: 'data/done.json', key: 'id', label: 'title', relation: true, source: 'done' },
  { section: 'events', file: 'data/events.json', key: 'id', label: 'title', relation: true, source: 'core' },
  { section: 'needs', file: 'data/needs.json', key: 'id', label: 'title', relation: true, source: 'core' }
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function definitionExists(text, dataset) {
  const section = escapeRegExp(dataset.section);
  const file = escapeRegExp(`/${dataset.file}`);
  return new RegExp(`(?:${section}\\s*:\\s*\\{|DATASETS\\.${section}\\s*=\\s*\\{)[\\s\\S]{0,2400}?file\\s*:\\s*['"]${file}['"]`).test(text);
}

function editorFieldExists(text, field) {
  return new RegExp(`\\[['"]${escapeRegExp(field)}['"]\\s*,`).test(text);
}

function readArray(relativePath, errors) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing dataset ${relativePath}`);
    return [];
  }
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(value)) {
      errors.push(`${relativePath} must contain an array`);
      return [];
    }
    return value;
  } catch (error) {
    errors.push(`invalid JSON ${relativePath}: ${error.message}`);
    return [];
  }
}

function main() {
  const errors = [];
  const indexHtml = read(INDEX_PATH);
  const coreText = read(CORE_PATH);
  const doneText = read(DONE_PATH);
  const dashboardText = read(DASHBOARD_PATH);
  const recordsBySection = new Map();
  let totalRecords = 0;

  for (const dataset of datasets) {
    const records = readArray(dataset.file, errors);
    recordsBySection.set(dataset.section, records);
    totalRecords += records.length;
  }

  const knownTosSlugs = new Set(
    (recordsBySection.get('toses') || [])
      .map((item) => String(item?.slug || '').trim())
      .filter(Boolean)
  );

  for (const dataset of datasets) {
    if (!indexHtml.includes(`data-section="${dataset.section}"`)) {
      errors.push(`admin index is missing tab ${dataset.section}`);
    }
    if (!indexHtml.includes(`<code>${dataset.file}</code>`)) {
      errors.push(`admin help is missing ${dataset.file}`);
    }

    const sourceText = dataset.source === 'done' ? doneText : coreText;
    if (!definitionExists(sourceText, dataset)) {
      errors.push(`dataset definition is missing or has wrong path: ${dataset.section}`);
    }
    if (!editorFieldExists(sourceText, dataset.label)) {
      errors.push(`dataset ${dataset.section} editor is missing label field ${dataset.label}`);
    }
    if (dataset.relation && !editorFieldExists(sourceText, 'tos_slug')) {
      errors.push(`related dataset ${dataset.section} editor is missing tos_slug`);
    }

    const records = recordsBySection.get(dataset.section) || [];
    const keys = new Set();
    records.forEach((record, index) => {
      const location = `${dataset.file}[${index}]`;
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        errors.push(`${location} must be an object`);
        return;
      }
      const identifier = String(record[dataset.key] || '').trim();
      if (!identifier) errors.push(`${location} is missing ${dataset.key}`);
      if (identifier && keys.has(identifier)) errors.push(`${location} duplicates ${dataset.key} ${identifier}`);
      if (identifier) keys.add(identifier);
      if (!(dataset.label in record) || !String(record[dataset.label] || '').trim()) {
        errors.push(`${location} is missing non-empty ${dataset.label}`);
      }
      const tosSlug = String(record.tos_slug || '').trim();
      if (dataset.relation && tosSlug && !knownTosSlugs.has(tosSlug)) {
        errors.push(`${location} references unknown tos_slug ${tosSlug}`);
      }
    });

    if (!dashboardText.includes(`/${dataset.file}`)) {
      errors.push(`dashboard does not load /${dataset.file}`);
    }
  }

  const scripts = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const expectedOrder = [
    '/admin/admin2.js',
    '/admin/admin-done-dataset.js',
    '/admin/admin-logo-tools.js',
    '/admin/admin-dashboard.js',
    '/admin/admin-export-tools.js',
    '/admin/admin-history.js'
  ];
  if (JSON.stringify(scripts) !== JSON.stringify(expectedOrder)) {
    errors.push(`admin scripts must use exact supported order: ${expectedOrder.join(', ')}`);
  }

  for (const token of [
    "download: 'done.json'",
    "['tos_slug','Привязка к ТОС: slug','tosSlug']",
    "['source_url','Ссылка на источник']",
    "['needs_details','Каких подтверждений не хватает','textarea']",
    "['content_origin','Происхождение материала','select:verified|editorial|starter|request']",
    "content_origin: 'request'"
  ]) {
    if (!doneText.includes(token)) errors.push(`done editor is missing ${token}`);
  }

  if (!dashboardText.includes('doneNeedsEvidence') || !dashboardText.includes('resultNeedsEvidence')) {
    errors.push('dashboard must calculate evidence gaps for results');
  }

  if (errors.length) {
    throw new Error(`Admin dataset schema audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Admin dataset schema OK: ${datasets.length} collections, ${totalRecords} records`);
}

main();
