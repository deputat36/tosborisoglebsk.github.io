const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN_INDEX_PATH = path.join(ROOT, 'admin', 'index.html');
const ADMIN_CORE_PATH = path.join(ROOT, 'admin', 'admin2.js');
const ADMIN_DONE_PATH = path.join(ROOT, 'admin', 'admin-done-dataset.js');
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

function escapeRegExp(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function datasetBlockExists(text, dataset){
  const section = escapeRegExp(dataset.section);
  const file = escapeRegExp(`/${dataset.file}`);
  const pattern = new RegExp(`(?:${section}\\s*:\\s*\\{|DATASETS\\.${section}\\s*=\\s*\\{)[\\s\\S]{0,1800}?file\\s*:\\s*['\"]${file}['\"]`);
  return pattern.test(text);
}

function fieldTokenExists(text, field){
  const escaped = escapeRegExp(field);
  return new RegExp(`\\[['\"]${escaped}['\"]\\s*,`).test(text);
}

function readJsonArray(relativePath, errors){
  const filePath = path.join(ROOT, relativePath);
  if(!fs.existsSync(filePath)){
    errors.push(`missing dataset file ${relativePath}`);
    return [];
  }

  try{
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if(!Array.isArray(value)){
      errors.push(`dataset must be an array ${relativePath}`);
      return [];
    }
    return value;
  }catch(error){
    errors.push(`invalid JSON ${relativePath}: ${error.message}`);
    return [];
  }
}

function main(){
  const errors = [];
  [ADMIN_INDEX_PATH, ADMIN_CORE_PATH, ADMIN_DONE_PATH, DASHBOARD_PATH].forEach(filePath => {
    if(!fs.existsSync(filePath)) errors.push(`missing admin schema file ${path.relative(ROOT, filePath)}`);
  });
  if(errors.length) throw new Error(`Admin dataset schema audit failed:\n${errors.join('\n')}`);

  const indexHtml = fs.readFileSync(ADMIN_INDEX_PATH, 'utf8');
  const coreText = fs.readFileSync(ADMIN_CORE_PATH, 'utf8');
  const doneText = fs.readFileSync(ADMIN_DONE_PATH, 'utf8');
  const dashboardText = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const recordsBySection = new Map();
  const seenFiles = new Set();
  let totalRecords = 0;

  datasets.forEach(dataset => {
    const records = readJsonArray(dataset.file, errors);
    recordsBySection.set(dataset.section, records);
    totalRecords += records.length;
  });

  const knownTosSlugs = new Set(
    (recordsBySection.get('toses') || []).map(item => String(item.slug || '').trim()).filter(Boolean)
  );

  datasets.forEach(dataset => {
    if(seenFiles.has(dataset.file)) errors.push(`duplicate admin dataset file ${dataset.file}`);
    seenFiles.add(dataset.file);

    if(!indexHtml.includes(`data-section="${dataset.section}"`)){
      errors.push(`admin index is missing tab ${dataset.section}`);
    }
    if(!indexHtml.includes(`<code>${dataset.file}</code>`)){
      errors.push(`admin help is missing dataset path ${dataset.file}`);
    }

    const sourceText = dataset.source === 'done' ? doneText : coreText;
    if(!datasetBlockExists(sourceText, dataset)){
      errors.push(`admin dataset definition is missing or has wrong path: ${dataset.section} -> /${dataset.file}`);
    }
    [dataset.key, dataset.label].forEach(field => {
      if(!fieldTokenExists(sourceText, field)) errors.push(`admin dataset ${dataset.section} is missing field ${field}`);
    });
    if(dataset.relation && !fieldTokenExists(sourceText, 'tos_slug')){
      errors.push(`related admin dataset ${dataset.section} is missing tos_slug field`);
    }

    const records = recordsBySection.get(dataset.section) || [];
    const ids = new Set();
    records.forEach((record, index) => {
      const line = `${dataset.file}[${index}]`;
      if(!record || typeof record !== 'object' || Array.isArray(record)){
        errors.push(`${line} must be an object`);
        return;
      }
      const identifier = String(record[dataset.key] || '').trim();
      if(!identifier) errors.push(`${line} is missing key ${dataset.key}`);
      if(identifier && ids.has(identifier)) errors.push(`${line} duplicates ${dataset.key} ${identifier}`);
      if(identifier) ids.add(identifier);
      if(!(dataset.label in record)) errors.push(`${line} is missing label field ${dataset.label}`);

      const tosSlug = String(record.tos_slug || '').trim();
      if(dataset.relation && tosSlug && !knownTosSlugs.has(tosSlug)){
        errors.push(`${line} references unknown tos_slug ${tosSlug}`);
      }
    });

    const dashboardPathToken = `/${dataset.file}`;
    if(!dashboardText.includes(dashboardPathToken)){
      errors.push(`admin dashboard does not load ${dashboardPathToken}`);
    }
  });

  const scriptOrder = [...indexHtml.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  const coreIndex = scriptOrder.indexOf('/admin/admin2.js');
  const doneIndex = scriptOrder.indexOf('/admin/admin-done-dataset.js');
  const dashboardIndex = scriptOrder.indexOf('/admin/admin-dashboard.js');
  if(coreIndex < 0 || doneIndex < 0 || dashboardIndex < 0){
    errors.push('admin script order cannot be checked because a required script is missing');
  }else if(!(coreIndex < doneIndex && doneIndex < dashboardIndex)){
    errors.push('admin scripts must load in order: admin2.js, admin-done-dataset.js, admin-dashboard.js');
  }

  [
    "download: 'done.json'",
    'label: (x) =>',
    'sub: (x) =>',
    'template: () =>',
    "['tos_slug','Привязка к ТОС: slug','tosSlug']",
    "['needs_details','Каких подтверждений не хватает','textarea']",
    "['content_origin','Происхождение материала','select:verified|editorial|starter|request']"
  ].forEach(token => {
    if(!doneText.includes(token)) errors.push(`done admin dataset must contain ${token}`);
  });

  if(!dashboardText.includes('doneNeedsEvidence')){
    errors.push('admin dashboard must calculate result evidence gaps');
  }

  if(errors.length){
    throw new Error(`Admin dataset schema audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Admin dataset schema OK: ${datasets.length} collections, ${totalRecords} records`);
}

main();