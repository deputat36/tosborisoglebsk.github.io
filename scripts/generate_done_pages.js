const fs = require('fs');
const path = require('path');
const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

function makePage(item, toses) {
  const title = item.title || 'История результата ТОС';
  const summary = item.summary || 'История результата территориального общественного самоуправления Борисоглебского городского округа.';
  const seoTitle = compactText(title, 56);
  const seoSummary = compactText(summary, 155);
  const canonical = `${SITE_URL}/done/${item.id}/`;
  const tos = item.tos_slug ? toses.find((entry) => entry.slug === item.tos_slug) : null;
  const image = item.image || '/assets/img/og-cover.svg';
  const imageFull = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const gallery = Array.isArray(item.gallery) ? item.gallery : [];
  const origin = inferContentOrigin(item, 'done');
  const originLabel = contentOriginLabel(origin);
  const originClass = contentOriginClass(origin);
  const originNotice = contentOriginNotice(origin, 'done');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: seoTitle,
    description: seoSummary,
    datePublished: item.date || '',
    image: imageFull,
    mainEntityOfPage: canonical,
    publisher: { '@type': 'Organization', name: 'Портал ТОС БГО' }
  };
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(seoTitle)} | Сделано ТОСами БГО</title>
  <meta name="description" content="${esc(seoSummary)}"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:title" content="${esc(seoTitle)}"/>
  <meta property="og:description" content="${esc(seoSummary)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:image" content="${esc(imageFull)}"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="stylesheet" href="/assets/css/styles.css"/>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/residents/">Жителям</a><a href="/partners/">Партнёрам</a><a href="/projects/">Проекты</a><a href="/done/">Сделано</a><a href="/needs/">Нужна помощь</a><a href="/documents/">Документы</a><a href="/contacts/">Контакты</a><a href="/sections/">Все разделы</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>
  <main id="main">
    <section class="hero"><div class="container hero-card"><a class="chip" href="/done/">← Сделано ТОСами</a><div class="eyebrow">${esc(item.type || 'История результата')} · ${esc(dateRu(item.date))}</div><div class="meta"><span class="tag ${esc(originClass)}">${esc(originLabel)}</span></div><h1>${esc(title)}</h1><p class="lead">${esc(summary)}</p><div class="hero-actions">${tos ? `<a class="btn primary" href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a>` : ''}<a class="btn" href="/done/">Все истории</a><a class="btn" href="/contacts/">Прислать детали</a></div></div></section>
    <section class="section tight"><div class="container notice"><b>Статус материала:</b> ${esc(originNotice)}</div></section>
    <section class="section"><div class="container grid">${stepCard('Было', item.before)}${stepCard('Сделали', item.done)}${stepCard('Стало', item.result)}</div></section>
    <section class="section"><div class="container prose"><p><b>Кто участвовал:</b> ${esc(item.participants || 'Информация уточняется.')}</p>${item.needs_details ? `<div class="notice"><b>Что нужно уточнить для полной истории</b><br>${esc(item.needs_details)}</div>` : ''}${gallery.length ? `<div class="grid">${gallery.map((src) => `<img src="${esc(src)}" alt="${esc(title)}" loading="lazy" style="width:100%;border-radius:20px;border:1px solid var(--line);">`).join('')}</div>` : ''}<hr class="sep"/><p class="source"><b>Источник:</b> ${esc(item.source_label || 'Редакция портала')}${item.source_url ? `<br><a href="${esc(item.source_url)}"${item.source_url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(item.source_url)}</a>` : ''}</p><div class="card-actions"><a class="btn primary" href="/contacts/">Прислать фото или уточнение</a><a class="btn" href="/needs/">Потребности ТОСов</a><a class="btn" href="/projects/">Банк проектов</a></div></div></section>
  </main>
  <footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница истории результата создана автоматически из data/done.json.</div></div></footer>
  <script src="/assets/js/site.js"></script>
</body>
</html>`;
}

function main() {
  const done = readJson(DONE_PATH).filter((item) => item.id && isPublished(item));
  const toses = readJson(TOSES_PATH);
  done.forEach((item) => write(path.join(ROOT, 'done', item.id, 'index.html'), makePage(item, toses)));
  console.log(`Generated done pages: ${done.length}`);
}

main();
