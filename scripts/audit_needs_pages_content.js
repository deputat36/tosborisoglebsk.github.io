const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const needsPath = path.join(process.cwd(), 'data', 'needs.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const needsIndexPath = path.join(process.cwd(), 'needs', 'index.html');
const needsScriptPath = path.join(process.cwd(), 'assets', 'js', 'needs.js');
const siteUrl = 'https://tosborisoglebsk.ru';

function pagePathForNeed(id) {
  return path.join(process.cwd(), 'needs', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function htmlEntityAmp(value) {
  return String(value || '').replace(/&/g, '&amp;');
}

function main() {
  const errors = [];

  [needsPath, tosesPath, needsIndexPath, needsScriptPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Needs pages content audit failed:\n${errors.join('\n')}`);
  }

  const needs = JSON.parse(fs.readFileSync(needsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const indexHtml = fs.readFileSync(needsIndexPath, 'utf8');
  const script = fs.readFileSync(needsScriptPath, 'utf8');

  if (!Array.isArray(needs)) {
    throw new Error('Needs pages content audit failed:\ndata/needs.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  expectIncludes(errors, 'needs index', indexHtml, '<html lang="ru">', 'page must declare Russian language');
  expectIncludes(errors, 'needs index', indexHtml, '<title>Нужна помощь ТОСам БГО — витрина потребностей и партнёрской поддержки</title>', 'unexpected title');
  expectIncludes(errors, 'needs index', indexHtml, '<link rel="canonical" href="https://tosborisoglebsk.ru/needs/"', 'missing canonical URL');
  expectIncludes(errors, 'needs index', indexHtml, '<meta property="og:url" content="https://tosborisoglebsk.ru/needs/"', 'missing Open Graph URL');
  expectIncludes(errors, 'needs index', indexHtml, '<h1>Витрина конкретных задач для ТОСов БГО</h1>', 'missing h1');
  expectIncludes(errors, 'needs index', indexHtml, 'потребность должна быть конкретной', 'specific-need principle is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-list"', 'needs list container is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-summary"', 'needs summary container is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-search"', 'needs search input is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-type-filter"', 'needs type filter is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-tos-filter"', 'needs TOS filter is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-priority-filter"', 'needs priority filter is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'id="needs-status-filter"', 'needs status filter is missing');
  expectIncludes(errors, 'needs index', indexHtml, '/assets/js/needs.js', 'needs.js is missing');
  expectIncludes(errors, 'needs index', indexHtml, '/needs/action-routes/', 'needs action route is missing');
  expectIncludes(errors, 'needs index', indexHtml, '/update-tos/?type=need#message-builder', 'need submission link is missing');
  expectIncludes(errors, 'needs index', indexHtml, 'раздел не предназначен для сбора персональных данных', 'personal-data caution is missing');

  expectIncludes(errors, 'needs script', script, "fetch('/data/needs.json'", 'needs data fetch is missing');
  expectIncludes(errors, 'needs script', script, "fetch('/data/toses.json'", 'TOS data fetch is missing');
  expectIncludes(errors, 'needs script', script, "item.status !== 'draft'", 'draft filtering is missing');
  expectIncludes(errors, 'needs script', script, 'needsEsc', 'HTML escaping helper is missing');
  expectIncludes(errors, 'needs script', script, 'needsFmtDate', 'date formatting helper is missing');
  expectIncludes(errors, 'needs script', script, 'renderNeedsSummary', 'summary rendering is missing');
  expectIncludes(errors, 'needs script', script, 'replace(/ё/g, \'е\')', 'yo normalization is missing');
  expectIncludes(errors, 'needs script', script, '/needs/${needsEsc(item.id)}/', 'detail route rendering is missing');
  expectIncludes(errors, 'needs script', script, '/update-tos/?type=need#message-builder', 'submission link is missing');
  expectIncludes(errors, 'needs script', script, 'target="_blank" rel="noopener"', 'external source links must open safely');

  needs.filter((item) => item && item.status !== 'draft').forEach((item, index) => {
    const line = `need page ${index + 1} ${item.id || 'unknown'}`;
    const id = item.id || '';
    const title = item.title || '';
    const description = item.description || '';
    const needType = item.need_type || '';
    const priority = item.priority || '';
    const contact = item.contact || '';
    const source = item.source || '';
    const date = item.date || '';
    const pageUrl = `${siteUrl}/needs/${id}/`;
    const filePath = pagePathForNeed(id);

    if (!id) {
      errors.push(`${line}: missing id`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing generated page /needs/${id}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, `<title>${title} | Нужна помощь ТОСам БГО</title>`, 'title must match need title template');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${pageUrl}"`, 'missing canonical URL');
    expectIncludes(errors, line, html, '<meta property="og:type" content="article"', 'Open Graph type must be article');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${pageUrl}"`, 'missing Open Graph URL');
    expectIncludes(errors, line, html, '"@type":"Article"', 'Article JSON-LD is missing');
    expectIncludes(errors, line, html, `"headline":"${title}`, 'JSON-LD headline is missing');
    if (date) expectIncludes(errors, line, html, `"datePublished":"${date}"`, 'JSON-LD datePublished is missing');
    expectIncludes(errors, line, html, `"mainEntityOfPage":"${pageUrl}"`, 'JSON-LD mainEntityOfPage is missing');
    expectIncludes(errors, line, html, '"publisher":{"@type":"Organization","name":"Портал ТОС БГО"}', 'JSON-LD publisher is missing');
    expectIncludes(errors, line, html, `<h1>${title}</h1>`, 'h1 must match need title');
    expectIncludes(errors, line, html, `<p class="lead">${description}</p>`, 'lead must match need description');
    expectIncludes(errors, line, html, '<a class="chip" href="/needs/">', 'back link to needs index is missing');
    expectIncludes(errors, line, html, 'Страница потребности создана автоматически из data/needs.json.', 'generated-data footer note is missing');
    expectIncludes(errors, line, html, '/assets/css/styles.css', 'styles.css is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');
    expectIncludes(errors, line, html, '/contacts/', 'contacts link is missing');
    expectIncludes(errors, line, html, '/partners/', 'partners link is missing');
    expectIncludes(errors, line, html, '/done/', 'done link is missing');
    expectIncludes(errors, line, html, 'Как помочь', 'how-to-help block is missing');

    if (needType) expectIncludes(errors, line, html, needType, 'need type is missing');
    if (priority) expectIncludes(errors, line, html, priority, 'priority is missing');
    if (contact) expectIncludes(errors, line, html, contact, 'contact is missing');
    if (source) expectIncludes(errors, line, html, `<b>Источник:</b> ${source}`, 'source label is missing');

    if (item.source_url) {
      expectIncludes(errors, line, html, `href="${htmlEntityAmp(item.source_url)}"`, 'source URL is missing');
      expectIncludes(errors, line, html, 'target="_blank" rel="noopener"', 'source URL must open safely');
    }

    if (item.tos_slug) {
      if (!tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
      if (!repoPathExists(`/tos/${item.tos_slug}/`)) errors.push(`${line}: linked TOS page is missing /tos/${item.tos_slug}/`);
      expectIncludes(errors, line, html, `href="/tos/${item.tos_slug}/"`, 'linked TOS route is missing');
    }
  });

  if (errors.length) {
    throw new Error(`Needs pages content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Needs pages content OK: ${needs.filter((item) => item && item.status !== 'draft').length} need pages checked`);
}

main();
