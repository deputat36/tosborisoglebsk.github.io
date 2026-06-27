const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const root = process.cwd();
const htmlPath = path.join(root, 'materials', 'index.html');
const scriptPath = path.join(root, 'assets', 'js', 'materials.js');
const dataPath = path.join(root, 'data', 'materials.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredIds = new Set([
  'tos-bgo-in-numbers',
  'documents',
  'create-tos',
  'chairperson',
  'project-route',
  'need-route',
  'done-route',
  'field-checklist',
  'communication-kit'
]);

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

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) {
    errors.push(`${label}: missing ${needle}`);
  }
}

function validateStringArray(errors, line, label, value) {
  if (!Array.isArray(value)) {
    errors.push(`${line}: ${label} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${line}: invalid ${label}[${index}]`);
    }
  });
}

function validateData(errors, materials) {
  if (!Array.isArray(materials)) {
    errors.push('data/materials.json must be an array');
    return;
  }

  const seenIds = new Set();
  const seenUrls = new Set();

  materials.forEach((item, index) => {
    const line = `material ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = item.id || '';
    const title = item.title || '';
    const category = item.category || '';
    const audience = item.audience || '';
    const description = item.description || '';
    const url = item.url || '';
    const status = item.status || '';

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 8) errors.push(`${line}: title is too short`);
    if (!category) errors.push(`${line}: missing category`);
    if (!audience) errors.push(`${line}: missing audience`);
    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 80) errors.push(`${line}: description is too short`);
    if (!['published', 'draft', 'archived'].includes(status)) errors.push(`${line}: unsupported status ${status}`);

    validateStringArray(errors, line, 'tags', item.tags);

    if (!url) {
      errors.push(`${line}: missing url`);
    } else {
      if (seenUrls.has(url)) errors.push(`${line}: duplicate url ${url}`);
      seenUrls.add(url);

      if (!url.startsWith('/') && !isHttpUrl(url)) {
        errors.push(`${line}: invalid url ${url}`);
      }

      if (url.startsWith('/') && !repoPathExists(url)) {
        errors.push(`${line}: missing local page ${url}`);
      }
    }
  });

  requiredIds.forEach((id) => {
    if (!seenIds.has(id)) {
      errors.push(`data/materials.json: missing required material ${id}`);
    }
  });
}

function main() {
  const html = read(htmlPath);
  const script = read(scriptPath);
  const materials = JSON.parse(read(dataPath));
  const errors = [];

  checkContains(errors, html, 'materials/index.html', '<html lang="ru"');
  checkContains(errors, html, 'materials/index.html', '<title>Полезные материалы для ТОС</title>');
  checkContains(errors, html, 'materials/index.html', 'https://tosborisoglebsk.ru/materials/');
  checkContains(errors, html, 'materials/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/materials/"');
  checkContains(errors, html, 'materials/index.html', '<h1>Полезные материалы для ТОС</h1>');
  checkContains(errors, html, 'materials/index.html', '/materials/tos-bgo-in-numbers/');
  checkContains(errors, html, 'materials/index.html', '/tos/');
  checkContains(errors, html, 'materials/index.html', 'id="articles-list"');
  checkContains(errors, html, 'materials/index.html', 'Загрузка материалов...');
  checkContains(errors, html, 'materials/index.html', '/assets/js/materials.js');

  checkContains(errors, script, 'assets/js/materials.js', "fetch('/data/materials.json')");
  checkContains(errors, script, 'assets/js/materials.js', 'materialsEsc');
  checkContains(errors, script, 'assets/js/materials.js', "item.status !== 'draft'");
  checkContains(errors, script, 'assets/js/materials.js', 'renderTags');
  checkContains(errors, script, 'assets/js/materials.js', 'item.audience');
  checkContains(errors, script, 'assets/js/materials.js', 'target="_blank" rel="noopener"');
  checkContains(errors, script, 'assets/js/materials.js', 'Раздел не загрузился. Проверьте файл data/materials.json.');

  validateData(errors, materials);

  if (errors.length) {
    throw new Error(`Materials page content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Materials page content OK: ${materials.length} materials`);
}

main();
