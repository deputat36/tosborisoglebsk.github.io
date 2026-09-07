const fs = require('fs');
const path = require('path');
require('./generate_verified_done_wave1');
const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');
const { buildCollectionContextLinks, collectionContextSectionId } = require('./lib/collection_context_navigation');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const boundary = sliced.lastIndexOf(' ');
  const base = sliced.slice(0, boundary > 50 ? boundary : sliced.length).replace(/[,:;.!?\s]+$/u, '');
  return `${base}…`;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function write(file, html) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
}

function isPublished(item) {
  return item && item.status !== 'draft';
}

function dateRu(value) {
  if (!value) return 'Дата уточняется';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function stepCard(title, text) {
  return `<article class="card"><div class="card-inner"><span class="tag">${esc(title)}</span><p>${esc(text || 'Информация уточняется.')}</p></div></article>`;
}

function main() {
  const items = readJson(DONE_PATH).filter(isPublished);
  const toses = readJson(TOSES_PATH);
  const tosBySlug = new Map(toses.map((tos) => [tos.slug, tos]));
  const allItems = [
    ...readJson(path.join(ROOT, 'data', 'news.json')).filter(isPublished).map((item) => ({ ...item, collection: 'news' })),
    ...readJson(path.join(ROOT, 'data', 'projects.json')).filter(isPublished).map((item) => ({ ...item, collection: 'projects' })),
    ...readJson(path.join(ROOT, 'data', 'needs.json')).filter(isPublished).map((item) => ({ ...item, collection: 'needs' })),
    ...items.map((item) => ({ ...item, collection: 'done' }))
  ];

  items.forEach((item) => {
    const tos = tosBySlug.get(item.tos_slug) || {};
    const origin = inferContentOrigin(item, 'done');
    const originLabel = contentOriginLabel(origin);
    const originClass = contentOriginClass(origin);
    const sourceHref = item.source_url || '';
    const sourceLink = sourceHref
      ? `<a href="${esc(sourceHref)}"${/^https?:\/\//.test(sourceHref) ? ' target="_blank" rel="noopener"' : ''}>${esc(item.source_label || 'Источник')}</a>`
      : esc(item.source_label || 'Источник не указан');
    const tosName = tos.name || item.tos_slug || 'ТОС';
    const canonicalPath = `/done/${item.id}/`;
    const contextLinks = buildCollectionContextLinks({
      item: { ...item, collection: 'done' },
      items: allItems,
      tosBySlug,
      currentPath: canonicalPath
    });
    const contextSectionId = collectionContextSectionId('done');
    const contextSection = contextLinks.length
      ? `<section class="section tight" id="${esc(contextSectionId)}"><div class="container"><div class="section-title"><h2>Что посмотреть дальше</h2></div><div class="grid cols-3">${contextLinks.map((link) => `<article class="card"><div class="card-inner"><span class="tag">${esc(link.label)}</span><h3><a href="${esc(link.href)}">${esc(link.title)}</a></h3><p>${esc(link.description)}</p></div></article>`).join('')}</div></div></section>`
      : '';
    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(item.title)} — ТОС БГО</title>
  <meta name="description" content="${esc(compactText(item.summary || item.result || item.title, 170))}">
  <link rel="canonical" href="${SITE_URL}${canonicalPath}">
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">К содержанию</a>
  <header class="site-header"><div class="container header-row"><a class="brand" href="/">ТОС БГО</a><nav class="nav" aria-label="Основная навигация"><a href="/tos/">ТОСы</a><a href="/projects/">Проекты</a><a href="/done/" aria-current="page">Результаты</a><a href="/news/">Новости</a><a href="/contacts/">Контакты</a></nav></div></header>
  <main id="main">
    <section class="hero compact"><div class="container"><p class="eyebrow">${esc(item.type || 'История результата')}</p><h1>${esc(item.title)}</h1><p>${esc(item.summary || '')}</p><div class="badges"><span class="badge ${esc(originClass)}">${esc(originLabel)}</span><span class="badge">${esc(dateRu(item.date))}</span></div></div></section>
    <section class="section tight"><div class="container grid cols-2">
      ${stepCard('Было', item.before)}
      ${stepCard('Сделано', item.done)}
      ${stepCard('Результат', item.result)}
      ${stepCard('Участники', item.participants)}
    </div></section>
    <section class="section tight"><div class="container"><article class="card"><div class="card-inner"><h2>Источник и статус</h2><p>${esc(contentOriginNotice(origin, 'done'))}</p><p><strong>Источник:</strong> ${sourceLink}</p>${item.needs_details ? `<p class="muted">Что ещё можно дополнить: ${esc(item.needs_details)}</p>` : ''}<p><a href="/tos/${esc(item.tos_slug)}/">Карточка ТОС «${esc(tosName)}»</a></p></div></article></div></section>
    ${contextSection}
  </main>
  <footer class="site-footer"><div class="container"><p>Портал ТОС Борисоглебского городского округа</p></div></footer>
</body>
</html>`;

    write(path.join(ROOT, 'done', item.id, 'index.html'), html);
  });

  console.log(`Done pages generated: ${items.length}`);
}

main();
