const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const NEEDS_PATH = path.join(ROOT, 'data', 'needs.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function priorityClass(priority) {
  if (String(priority).toLowerCase().includes('выс')) return 'warn';
  if (String(priority).toLowerCase().includes('низ')) return 'ok';
  return '';
}

function infoCard(title, text, tag = '') {
  return `<article class="card"><div class="card-inner">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<h3>${esc(title)}</h3><p>${esc(text || 'Информация уточняется.')}</p></div></article>`;
}

function makePage(item, toses) {
  const title = item.title || 'Потребность ТОС БГО';
  const description = item.description || 'Актуальная потребность территориального общественного самоуправления Борисоглебского городского округа.';
  const canonical = `${SITE_URL}/needs/${item.id}/`;
  const tos = item.tos_slug ? toses.find((entry) => entry.slug === item.tos_slug) : null;
  const image = item.image || '/assets/img/og-cover.svg';
  const imageFull = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
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
  <title>${esc(title)} | Нужна помощь ТОСам БГО</title>
  <meta name="description" content="${esc(description)}"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
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
    <section class="hero"><div class="container hero-card"><a class="chip" href="/needs/">← Все потребности</a><div class="eyebrow">${esc(item.need_type || 'Потребность')} · ${esc(dateRu(item.date))}</div><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/contacts/">Предложить помощь</a>${tos ? `<a class="btn" href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a>` : ''}<a class="btn" href="/partners/">Партнёрам</a><a class="btn" href="/done/">Истории результата</a></div></div></section>
    <section class="section"><div class="container grid">${infoCard('Что нужно', description, item.need_type || 'Потребность')}${infoCard('Приоритет', item.priority || 'Уточняется', priorityClass(item.priority))}${infoCard('Контакт', item.contact || 'Контакт уточняется', 'Связь')}</div></section>
    <section class="section"><div class="container prose"><div class="notice"><b>Как помочь</b><br>Свяжитесь с ответственным, уточните количество, сроки, место передачи помощи и нужен ли фотоотчёт. После закрытия потребности желательно прислать короткую историю результата.</div><p><b>Источник:</b> ${esc(item.source || 'Редакция портала')}${item.source_url ? `<br><a href="${esc(item.source_url)}"${item.source_url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(item.source_url)}</a>` : ''}</p><div class="card-actions"><a class="btn primary" href="/contacts/">Связаться</a><a class="btn" href="https://vk.ru/tosbgo" target="_blank" rel="noopener">ВК ТОС БГО</a><a class="btn" href="/needs/">Все потребности</a></div></div></section>
  </main>
  <footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница потребности создана автоматически из data/needs.json.</div></div></footer>
  <script src="/assets/js/site.js"></script>
</body>
</html>`;
}

function main() {
  const needs = readJson(NEEDS_PATH).filter((item) => item.id && isPublished(item));
  const toses = readJson(TOSES_PATH);
  needs.forEach((item) => write(path.join(ROOT, 'needs', item.id, 'index.html'), makePage(item, toses)));
  console.log(`Generated need pages: ${needs.length}`);
}

main();
