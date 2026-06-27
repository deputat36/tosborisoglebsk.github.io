const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const root = process.cwd();
const htmlPath = path.join(root, 'documents', 'index.html');
const scriptPath = path.join(root, 'assets', 'js', 'documents.js');
const dataPath = path.join(root, 'data', 'documents.json');
const requiredTitles = [
  'Федеральный закон №33-ФЗ от 20.03.2025',
  'Устав Борисоглебского городского округа',
  'Шаблон: карточка ТОС для сайта',
  'Шаблон: объявление о собрании жителей ТОС',
  'Шаблон: паспорт проекта ТОС',
  'Шаблон: фотоотчёт проекта или мероприятия ТОС'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function normalizeLocalUrl(url) {
  if (!url || isHttpUrl(url)) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) {
    errors.push(`${label}: missing ${needle}`);
  }
}

function validateData(errors, documents) {
  if (!Array.isArray(documents)) {
    errors.push('data/documents.json must be an array');
    return;
  }

  const seenTitles = new Set();
  const seenUrls = new Set();

  documents.forEach((item, index) => {
    const line = `document ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const title = item.title || '';
    const type = item.type || '';
    const status = item.status || '';
    const description = item.description || '';
    const useFor = item.use_for || '';
    const attention = item.attention || '';
    const url = item.url || '';
    const date = item.date || '';

    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 8) errors.push(`${line}: title is too short`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);

    if (!type) errors.push(`${line}: missing type`);
    if (!status) errors.push(`${line}: missing status`);
    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 80) errors.push(`${line}: description is too short`);
    if (!useFor) errors.push(`${line}: missing use_for`);
    if (useFor && useFor.length < 40) errors.push(`${line}: use_for is too short`);
    if (!attention) errors.push(`${line}: missing attention`);
    if (!date) errors.push(`${line}: missing date`);

    if (!url) {
      errors.push(`${line}: missing url`);
    } else {
      if (seenUrls.has(url)) errors.push(`${line}: duplicate url ${url}`);
      seenUrls.add(url);

      const normalizedUrl = normalizeLocalUrl(url);
      if (!normalizedUrl.startsWith('/') && !isHttpUrl(normalizedUrl)) {
        errors.push(`${line}: invalid url ${url}`);
      }

      if (normalizedUrl.startsWith('/') && !repoPathExists(normalizedUrl)) {
        errors.push(`${line}: missing local document or page ${normalizedUrl}`);
      }
    }
  });

  requiredTitles.forEach((title) => {
    if (!seenTitles.has(title)) {
      errors.push(`data/documents.json: missing required document ${title}`);
    }
  });
}

function main() {
  const html = read(htmlPath);
  const script = read(scriptPath);
  const documents = JSON.parse(read(dataPath));
  const errors = [];

  checkContains(errors, html, 'documents/index.html', '<html lang="ru"');
  checkContains(errors, html, 'documents/index.html', '<title>Документы и шаблоны для ТОС БГО — библиотека председателя</title>');
  checkContains(errors, html, 'documents/index.html', 'https://tosborisoglebsk.ru/documents/');
  checkContains(errors, html, 'documents/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/documents/"');
  checkContains(errors, html, 'documents/index.html', '<h1>Документы и шаблоны для председателей и активистов</h1>');
  checkContains(errors, html, 'documents/index.html', 'id="documents-list"');
  checkContains(errors, html, 'documents/index.html', 'Загрузка списка документов...');
  checkContains(errors, html, 'documents/index.html', '/documents/templates/tos-creation-kit/');
  checkContains(errors, html, 'documents/index.html', '/chairperson/meeting/#meeting-documents');
  checkContains(errors, html, 'documents/index.html', '/documents/templates/project-kit/');
  checkContains(errors, html, 'documents/index.html', '/assets/js/documents.js');

  checkContains(errors, script, 'assets/js/documents.js', "fetch('/data/documents.json')");
  checkContains(errors, script, 'assets/js/documents.js', 'documentsEsc');
  checkContains(errors, script, 'assets/js/documents.js', 'normalizeUrl');
  checkContains(errors, script, 'assets/js/documents.js', 'target="_blank" rel="noopener"');
  checkContains(errors, script, 'assets/js/documents.js', 'item.attention');
  checkContains(errors, script, 'assets/js/documents.js', 'item.use_for');
  checkContains(errors, script, 'assets/js/documents.js', 'Список документов не загрузился. Проверьте файл data/documents.json.');

  validateData(errors, documents);

  if (errors.length) {
    throw new Error(`Documents page content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Documents page content OK: ${documents.length} documents`);
}

main();
