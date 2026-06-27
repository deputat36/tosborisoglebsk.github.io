const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const projectsIndexPath = path.join(process.cwd(), 'projects', 'index.html');
const projectsScriptPath = path.join(process.cwd(), 'assets', 'js', 'projects.js');
const siteUrl = 'https://tosborisoglebsk.ru';

function pagePathForProject(id) {
  return path.join(process.cwd(), 'projects', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function htmlEntityAmp(value) {
  return String(value || '').replace(/&/g, '&amp;');
}

function main() {
  const errors = [];

  [projectsPath, tosesPath, projectsIndexPath, projectsScriptPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Project pages content audit failed:\n${errors.join('\n')}`);
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const indexHtml = fs.readFileSync(projectsIndexPath, 'utf8');
  const script = fs.readFileSync(projectsScriptPath, 'utf8');

  if (!Array.isArray(projects)) {
    throw new Error('Project pages content audit failed:\ndata/projects.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  expectIncludes(errors, 'projects index', indexHtml, '<html lang="ru">', 'page must declare Russian language');
  expectIncludes(errors, 'projects index', indexHtml, '<title>Банк проектов ТОС — идеи, гранты, партнёры и помощь</title>', 'unexpected title');
  expectIncludes(errors, 'projects index', indexHtml, '<link rel="canonical" href="https://tosborisoglebsk.ru/projects/"', 'missing canonical URL');
  expectIncludes(errors, 'projects index', indexHtml, '<meta property="og:url" content="https://tosborisoglebsk.ru/projects/"', 'missing Open Graph URL');
  expectIncludes(errors, 'projects index', indexHtml, '<h1>Банк идей для проектов ТОС</h1>', 'missing h1');
  expectIncludes(errors, 'projects index', indexHtml, 'Банк проектов — рабочая база идей, а не гарантия финансирования.', 'financing caution is missing');
  expectIncludes(errors, 'projects index', indexHtml, 'id="projects-list"', 'projects list container is missing');
  expectIncludes(errors, 'projects index', indexHtml, '/assets/js/projects.js', 'projects.js is missing');
  expectIncludes(errors, 'projects index', indexHtml, '/projects/action-routes/', 'project action route is missing');
  expectIncludes(errors, 'projects index', indexHtml, '/update-tos/?type=project#message-builder', 'project submission link is missing');

  expectIncludes(errors, 'projects script', script, "fetch('/data/projects.json'", 'projects data fetch is missing');
  expectIncludes(errors, 'projects script', script, "fetch('/data/toses.json'", 'TOS data fetch is missing');
  expectIncludes(errors, 'projects script', script, "item.status !== 'draft'", 'draft filtering is missing');
  expectIncludes(errors, 'projects script', script, 'projectEsc', 'HTML escaping helper is missing');
  expectIncludes(errors, 'projects script', script, 'localeCompare', 'Russian title sorting is missing');
  expectIncludes(errors, 'projects script', script, '`/projects/${projectEsc(item.id)}/`', 'detail route rendering is missing');
  expectIncludes(errors, 'projects script', script, '/projects/action-routes/', 'action route link is missing');
  expectIncludes(errors, 'projects script', script, '/update-tos/?type=project#message-builder', 'submission link is missing');
  expectIncludes(errors, 'projects script', script, 'target="_blank" rel="noopener"', 'external source links must open safely');

  projects.filter((item) => item && item.status !== 'draft').forEach((item, index) => {
    const line = `project page ${index + 1} ${item.id || 'unknown'}`;
    const id = item.id || '';
    const title = item.title || '';
    const description = item.description || '';
    const type = item.type || '';
    const grantLogic = item.grant_logic || '';
    const basedOn = item.based_on || '';
    const pageUrl = `${siteUrl}/projects/${id}/`;
    const filePath = pagePathForProject(id);

    if (!id) {
      errors.push(`${line}: missing id`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing generated page /projects/${id}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, `<title>${title} | Проекты ТОС БГО</title>`, 'title must match project title template');
    expectIncludes(errors, line, html, `<meta name="description" content="${htmlEntityAmp(description)}"`, 'meta description must match project description');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${pageUrl}"`, 'missing canonical URL');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${pageUrl}"`, 'missing Open Graph URL');
    expectIncludes(errors, line, html, '"@type":"CreativeWork"', 'CreativeWork JSON-LD is missing');
    expectIncludes(errors, line, html, `"url":"${pageUrl}"`, 'JSON-LD URL is missing');
    expectIncludes(errors, line, html, '"provider":{"@type":"Organization","name":"Портал ТОС БГО"}', 'JSON-LD provider is missing');
    expectIncludes(errors, line, html, `<h1>${title}</h1>`, 'h1 must match project title');
    expectIncludes(errors, line, html, `<p class="lead">${description}</p>`, 'lead must match project description');
    expectIncludes(errors, line, html, '<a class="chip" href="/projects/">', 'back link to projects index is missing');
    expectIncludes(errors, line, html, 'Страница проекта создана автоматически из data/projects.json.', 'generated-data footer note is missing');
    expectIncludes(errors, line, html, '/assets/css/styles.css', 'styles.css is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');
    expectIncludes(errors, line, html, '/update-tos/?type=project#message-builder', 'project submission link is missing');
    expectIncludes(errors, line, html, '/grants/', 'grants link is missing');
    expectIncludes(errors, line, html, '/chairperson/', 'chairperson link is missing');
    expectIncludes(errors, line, html, '/projects/', 'projects index link is missing');

    if (type) expectIncludes(errors, line, html, type, 'project type is missing');
    if (grantLogic) expectIncludes(errors, line, html, grantLogic, 'grant logic is missing');
    if (basedOn) expectIncludes(errors, line, html, basedOn, 'based_on text is missing');

    if (!Array.isArray(item.steps) || !item.steps.length) {
      errors.push(`${line}: project steps are missing in data`);
    } else {
      item.steps.forEach((step, stepIndex) => {
        if (!html.includes(`<li>${step}</li>`)) {
          errors.push(`${line}: missing step ${stepIndex + 1}`);
        }
      });
    }

    if (item.tos_slug) {
      if (!tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
      if (!repoPathExists(`/tos/${item.tos_slug}/`)) errors.push(`${line}: linked TOS page is missing /tos/${item.tos_slug}/`);
      expectIncludes(errors, line, html, `href="/tos/${item.tos_slug}/"`, 'linked TOS route is missing');
    }
  });

  if (errors.length) {
    throw new Error(`Project pages content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Project pages content OK: ${projects.filter((item) => item && item.status !== 'draft').length} project pages checked`);
}

main();
