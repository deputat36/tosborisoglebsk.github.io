const fs = require('fs');
const path = require('path');

const grantsPath = path.join(process.cwd(), 'data', 'grants.json');
const grantsIndexPath = path.join(process.cwd(), 'grants', 'index.html');
const grantsScriptPath = path.join(process.cwd(), 'assets', 'js', 'grants.js');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function expectIncludes(errors, line, content, value, message) {
  if (!content.includes(value)) errors.push(`${line}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function main() {
  const errors = [];

  [grantsPath, grantsIndexPath, grantsScriptPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Grants page content audit failed:\n${errors.join('\n')}`);
  }

  const grants = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));
  const html = fs.readFileSync(grantsIndexPath, 'utf8');
  const script = fs.readFileSync(grantsScriptPath, 'utf8');

  if (!Array.isArray(grants)) {
    throw new Error('Grants page content audit failed:\ndata/grants.json must be an array');
  }

  expectIncludes(errors, 'grants index', html, '<html lang="ru">', 'page must declare Russian language');
  expectIncludes(errors, 'grants index', html, '<title>Поддержка проектов ТОС БГО — региональные организации, конкурсы и гранты</title>', 'unexpected title');
  expectIncludes(errors, 'grants index', html, '<link rel="canonical" href="https://tosborisoglebsk.ru/grants/"', 'missing canonical URL');
  expectIncludes(errors, 'grants index', html, '<meta property="og:url" content="https://tosborisoglebsk.ru/grants/"', 'missing Open Graph URL');
  expectIncludes(errors, 'grants index', html, '<h1>Региональная экосистема, конкурсы и партнёры для ТОС</h1>', 'missing h1');
  expectIncludes(errors, 'grants index', html, 'Федеральные платформы Добро.рф, #МЫВМЕСТЕ и Росмолодёжь оставлены как дополнительные возможности', 'federal-platform caution is missing');
  expectIncludes(errors, 'grants index', html, 'Региональная экосистема ТОС Воронежской области', 'regional ecosystem block is missing');
  expectIncludes(errors, 'grants index', html, 'Конкурс проектов ТОС Воронежской области', 'regional TOS contest block is missing');
  expectIncludes(errors, 'grants index', html, 'Ассоциация муниципальных образований', 'municipal association block is missing');
  expectIncludes(errors, 'grants index', html, 'Ассоциации и объединения ТОС', 'TOS association block is missing');
  expectIncludes(errors, 'grants index', html, 'id="grants-list"', 'grants list container is missing');
  expectIncludes(errors, 'grants index', html, '/assets/js/grants.js', 'grants.js is missing');
  expectIncludes(errors, 'grants index', html, '/projects/', 'projects link is missing');
  expectIncludes(errors, 'grants index', html, '/documents/', 'documents link is missing');
  expectIncludes(errors, 'grants index', html, '/update-tos/?type=project#message-builder', 'project submission link is missing');
  expectIncludes(errors, 'grants index', html, 'конкретные сроки нужно сверять по официальным каналам', 'source verification notice is missing');

  expectIncludes(errors, 'grants script', script, "fetch('/data/grants.json'", 'grants data fetch is missing');
  expectIncludes(errors, 'grants script', script, 'grantsEsc', 'HTML escaping helper is missing');
  expectIncludes(errors, 'grants script', script, "item.status !== 'draft'", 'draft filtering is missing');
  expectIncludes(errors, 'grants script', script, 'project_links', 'project link rendering is missing');
  expectIncludes(errors, 'grants script', script, '/projects/${grantsEsc(slug)}/', 'project route rendering is missing');
  expectIncludes(errors, 'grants script', script, 'target="_blank" rel="noopener"', 'external source links must open safely');
  expectIncludes(errors, 'grants script', script, '/update-tos/?type=project#message-builder', 'project submission link is missing');
  expectIncludes(errors, 'grants script', script, 'Раздел не загрузился. Проверьте файл data/grants.json', 'load error message is missing');

  const requiredIds = new Set([
    'tos-voronezh-projects-2026',
    'association-municipalities-voronezh',
    'association-tos-voronezh',
    'obraz-budushchego',
    'rodnye-berega'
  ]);
  const seenIds = new Set();

  grants.forEach((item, index) => {
    const line = `grant ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = item.id || '';
    const title = item.title || '';
    const category = item.category || '';
    const status = item.status || '';
    const amount = item.amount || '';
    const deadline = item.deadline || '';
    const difficulty = item.difficulty || '';
    const bestFor = item.best_for || '';
    const note = item.note || '';

    if (!id) errors.push(`${line}: missing id`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);
    if (!title) errors.push(`${line}: missing title`);
    if (!category) errors.push(`${line}: missing category`);
    if (!status) errors.push(`${line}: missing status`);
    if (!amount) errors.push(`${line}: missing amount`);
    if (!deadline) errors.push(`${line}: missing deadline`);
    if (!difficulty) errors.push(`${line}: missing difficulty`);
    if (!bestFor) errors.push(`${line}: missing best_for`);
    if (!note) errors.push(`${line}: missing note`);

    if (!Array.isArray(item.prepare) || item.prepare.length < 4) {
      errors.push(`${line}: prepare must contain at least 4 items`);
    }

    if (!Array.isArray(item.project_links)) {
      errors.push(`${line}: project_links must be an array`);
    } else {
      item.project_links.forEach((projectId, projectIndex) => {
        if (typeof projectId !== 'string' || !slugPattern.test(projectId)) {
          errors.push(`${line}: invalid project_links[${projectIndex}] ${projectId}`);
        }
      });
    }
  });

  requiredIds.forEach((id) => {
    if (!seenIds.has(id)) errors.push(`missing required regional opportunity ${id}`);
  });

  if (errors.length) {
    throw new Error(`Grants page content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Grants page content OK: ${grants.length} opportunities checked`);
}

main();
