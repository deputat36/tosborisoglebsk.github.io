const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const donePath = path.join(process.cwd(), 'data', 'done.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const doneIndexPath = path.join(process.cwd(), 'done', 'index.html');
const doneScriptPath = path.join(process.cwd(), 'assets', 'js', 'done.js');
const siteUrl = 'https://tosborisoglebsk.ru';

function pagePathForDone(id) {
  return path.join(process.cwd(), 'done', id, 'index.html');
}

function expectIncludes(errors, line, html, value, message) {
  if (!html.includes(value)) errors.push(`${line}: ${message}`);
}

function htmlEntityAmp(value) {
  return String(value || '').replace(/&/g, '&amp;');
}

function main() {
  const errors = [];

  [donePath, tosesPath, doneIndexPath, doneScriptPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Done pages content audit failed:\n${errors.join('\n')}`);
  }

  const doneItems = JSON.parse(fs.readFileSync(donePath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const indexHtml = fs.readFileSync(doneIndexPath, 'utf8');
  const script = fs.readFileSync(doneScriptPath, 'utf8');

  if (!Array.isArray(doneItems)) {
    throw new Error('Done pages content audit failed:\ndata/done.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  expectIncludes(errors, 'done index', indexHtml, '<html lang="ru">', 'page must declare Russian language');
  expectIncludes(errors, 'done index', indexHtml, '<title>Сделано ТОСами БГО — истории результата, проекты и благоустройство</title>', 'unexpected title');
  expectIncludes(errors, 'done index', indexHtml, '<link rel="canonical" href="https://tosborisoglebsk.ru/done/"', 'missing canonical URL');
  expectIncludes(errors, 'done index', indexHtml, '<meta property="og:url" content="https://tosborisoglebsk.ru/done/"', 'missing Open Graph URL');
  expectIncludes(errors, 'done index', indexHtml, '<h1>Сделано ТОСами: было, сделали, стало</h1>', 'missing h1');
  expectIncludes(errors, 'done index', indexHtml, 'первые истории собраны по данным карточек ТОСов на портале', 'source limitation notice is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-statuses"', 'result trust legend is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Подтверждено источником', 'verified origin explanation is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Редакционный материал', 'editorial origin explanation is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Стартовый материал', 'starter origin explanation is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Запрос истории', 'request origin explanation is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Наличие карточки в разделе ещё не доказывает', 'catalog caution is missing');
  expectIncludes(errors, 'done index', indexHtml, 'отсутствие списка уточнений не означает автоматическую готовность материала для отчёта', 'archive readiness caution is missing');
  expectIncludes(errors, 'done index', indexHtml, '/content-standards/', 'content standards link is missing');
  expectIncludes(errors, 'done index', indexHtml, '/documents/templates/project-photo-report/', 'photo report template link is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-list"', 'done list container is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-summary"', 'done summary container is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-search"', 'done search input is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-type-filter"', 'done type filter is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-tos-filter"', 'done TOS filter is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-year-filter"', 'done year filter is missing');
  expectIncludes(errors, 'done index', indexHtml, 'id="done-status-filter"', 'done status filter is missing');
  expectIncludes(errors, 'done index', indexHtml, '/assets/js/done.js', 'done.js is missing');
  expectIncludes(errors, 'done index', indexHtml, '/done/action-routes/', 'done action route is missing');
  expectIncludes(errors, 'done index', indexHtml, '/update-tos/?type=photo#message-builder', 'photo report submission link is missing');
  expectIncludes(errors, 'done index', indexHtml, 'Истории хранятся в data/done.json', 'data footer note is missing');

  expectIncludes(errors, 'done script', script, "fetch('/data/done.json'", 'done data fetch is missing');
  expectIncludes(errors, 'done script', script, "fetch('/data/toses.json'", 'TOS data fetch is missing');
  expectIncludes(errors, 'done script', script, "item.status !== 'draft'", 'draft filtering is missing');
  expectIncludes(errors, 'done script', script, 'doneEsc', 'HTML escaping helper is missing');
  expectIncludes(errors, 'done script', script, 'doneYear', 'year helper is missing');
  expectIncludes(errors, 'done script', script, 'doneReviewTag', 'verified review-state helper is missing');
  expectIncludes(errors, 'done script', script, "origin === 'verified' && item.source_url && !item.needs_details", 'verified result must require source and no pending details');
  expectIncludes(errors, 'done script', script, 'подтверждённый результат', 'verified result label is missing');
  expectIncludes(errors, 'done script', script, 'редакционная история', 'editorial result label is missing');
  expectIncludes(errors, 'done script', script, 'нужны материалы', 'request result label is missing');
  expectIncludes(errors, 'done script', script, 'подтверждённые результаты', 'verified summary metric is missing');
  expectIncludes(errors, 'done script', script, 'редакционные истории', 'editorial summary metric is missing');
  expectIncludes(errors, 'done script', script, 'renderDoneSummary', 'summary rendering is missing');
  expectIncludes(errors, 'done script', script, "replace(/ё/g, 'е')", 'yo normalization is missing');
  expectIncludes(errors, 'done script', script, '/done/${doneEsc(item.id)}/', 'detail route rendering is missing');
  expectIncludes(errors, 'done script', script, 'needs_details', 'details-needed flag rendering is missing');
  expectIncludes(errors, 'done script', script, '/contacts/', 'contacts link is missing');
  expectIncludes(errors, 'done script', script, '/partners/', 'partners link is missing');
  expectIncludes(errors, 'done script', script, 'target="_blank" rel="noopener"', 'external source links must open safely');

  if (script.includes('готово для архива')) {
    errors.push('done script: editorial or incomplete stories must not be marked ready for archive automatically');
  }
  if (script.includes('<span class="tag ok">Стало</span>')) {
    errors.push('done script: the result step must not use success styling without verified origin');
  }

  doneItems.filter((item) => item && item.status !== 'draft').forEach((item, index) => {
    const line = `done page ${index + 1} ${item.id || 'unknown'}`;
    const id = item.id || '';
    const title = item.title || '';
    const summary = item.summary || '';
    const type = item.type || '';
    const before = item.before || '';
    const doneText = item.done || '';
    const result = item.result || '';
    const participants = item.participants || '';
    const needsDetails = item.needs_details || '';
    const sourceLabel = item.source_label || '';
    const date = item.date || '';
    const pageUrl = `${siteUrl}/done/${id}/`;
    const filePath = pagePathForDone(id);

    if (!id) {
      errors.push(`${line}: missing id`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      errors.push(`${line}: missing generated page /done/${id}/`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');

    expectIncludes(errors, line, html, '<html lang="ru">', 'page must declare Russian language');
    expectIncludes(errors, line, html, '| Сделано ТОСами БГО</title>', 'title must use done template');
    expectIncludes(errors, line, html, `<link rel="canonical" href="${pageUrl}"`, 'missing canonical URL');
    expectIncludes(errors, line, html, '<meta property="og:type" content="article"', 'Open Graph type must be article');
    expectIncludes(errors, line, html, `<meta property="og:url" content="${pageUrl}"`, 'missing Open Graph URL');
    expectIncludes(errors, line, html, '"@type":"Article"', 'Article JSON-LD is missing');
    expectIncludes(errors, line, html, `"datePublished":"${date}"`, 'JSON-LD datePublished is missing');
    expectIncludes(errors, line, html, `"mainEntityOfPage":"${pageUrl}"`, 'JSON-LD mainEntityOfPage is missing');
    expectIncludes(errors, line, html, '"publisher":{"@type":"Organization","name":"Портал ТОС БГО"}', 'JSON-LD publisher is missing');
    expectIncludes(errors, line, html, `<h1>${title}</h1>`, 'h1 must match done title');
    expectIncludes(errors, line, html, `<p class="lead">${summary}</p>`, 'lead must match summary');
    expectIncludes(errors, line, html, '<a class="chip" href="/done/">', 'back link to done index is missing');
    expectIncludes(errors, line, html, 'Страница истории результата создана автоматически из data/done.json.', 'generated-data footer note is missing');
    expectIncludes(errors, line, html, '/assets/css/styles.css', 'styles.css is missing');
    expectIncludes(errors, line, html, '/assets/js/site.js', 'site.js is missing');
    expectIncludes(errors, line, html, 'data-action="menu"', 'menu control is missing');
    expectIncludes(errors, line, html, 'data-action="theme"', 'theme control is missing');
    expectIncludes(errors, line, html, '/contacts/', 'contacts link is missing');
    expectIncludes(errors, line, html, '/needs/', 'needs link is missing');
    expectIncludes(errors, line, html, '/projects/', 'projects link is missing');
    expectIncludes(errors, line, html, 'Было', 'before block is missing');
    expectIncludes(errors, line, html, 'Сделали', 'done block is missing');
    expectIncludes(errors, line, html, 'Стало', 'result block is missing');

    if (type) expectIncludes(errors, line, html, type, 'done type is missing');
    if (before) expectIncludes(errors, line, html, before, 'before text is missing');
    if (doneText) expectIncludes(errors, line, html, doneText, 'done text is missing');
    if (result) expectIncludes(errors, line, html, result, 'result text is missing');
    if (participants) expectIncludes(errors, line, html, participants, 'participants text is missing');
    if (needsDetails) expectIncludes(errors, line, html, needsDetails, 'needs_details text is missing');
    if (sourceLabel) expectIncludes(errors, line, html, `<b>Источник:</b> ${sourceLabel}`, 'source label is missing');

    if (item.source_url) {
      expectIncludes(errors, line, html, `href="${htmlEntityAmp(item.source_url)}"`, 'source URL is missing');
    }

    if (item.tos_slug) {
      if (!tosSlugs.has(item.tos_slug)) errors.push(`${line}: unknown tos_slug ${item.tos_slug}`);
      if (!repoPathExists(`/tos/${item.tos_slug}/`)) errors.push(`${line}: linked TOS page is missing /tos/${item.tos_slug}/`);
      expectIncludes(errors, line, html, `href="/tos/${item.tos_slug}/"`, 'linked TOS route is missing');
    }
  });

  if (errors.length) {
    throw new Error(`Done pages content audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Done pages content OK: ${doneItems.filter((item) => item && item.status !== 'draft').length} done pages checked`);
}

main();
