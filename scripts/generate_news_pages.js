const fs = require('fs');
const path = require('path');
const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const ARTICLES_PATH = path.join(ROOT, 'data', 'articles.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

function esc(v){
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function readJson(file){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return []; }
}
function write(file, html){
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, html, 'utf8');
}
function isPublished(item){
  return item && item.status !== 'draft';
}
function safeDate(value){
  if(!value) return '';
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}
function paragraphs(value, fallback){
  if(Array.isArray(value) && value.length) return value.filter(Boolean);
  if(typeof value === 'string' && value.trim()) return [value.trim()];
  return [fallback || 'Информация уточняется.'];
}
function dateRu(value){
  if(!value) return '';
  const d = new Date(String(value) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
}
function absoluteUrl(url){
  if(!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
function addUrl(map, loc, lastmod = ''){
  if(!loc) return;
  const normalized = absoluteUrl(loc);
  map.set(normalized, lastmod || map.get(normalized) || '');
}
function sourceLink(url){
  if(!url) return '';
  const external = /^https?:\/\//i.test(url);
  const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<br><a href="${esc(url)}"${attributes}>Открыть источник</a>`;
}
function implementationSource(item){
  if(!item.implementation_source && !item.implementation_source_url) return '';
  return `<br><br><b>Подтверждение реализации:</b> ${esc(item.implementation_source || 'Дополнительный источник')}${sourceLink(item.implementation_source_url)}`;
}
function buildContextLinks(item, tos, origin){
  const contextText = [
    item.category,
    item.title,
    item.lead,
    ...(Array.isArray(item.text) ? item.text : [item.text])
  ].filter(Boolean).join(' ');

  const links = [];
  const add = (href, label) => {
    if(!href || !label || links.some((link) => link.href === href)) return;
    links.push({href, label});
  };

  if(tos) add(`/tos/${tos.slug}/`, `Карточка ТОС «${tos.name}»`);

  const topicRules = [
    {pattern: /(грант|конкурс|субсид|заявк)/i, href: '/grants/', label: 'Конкурсы и гранты'},
    {pattern: /(прав|закон|устав|собрани|регистрац|границ)/i, href: '/legal/', label: 'Правовая база ТОС'},
    {pattern: /(проект|благоустрой|площадк|ремонт|смет|инициатив)/i, href: '/projects/', label: 'Банк проектов и идей'},
    {pattern: /(партн|спонсор|организац|предпринимат)/i, href: '/partners/', label: 'Партнёрам и организациям'},
    {pattern: /(новост|фото|публикац|соцсет|канал|материал)/i, href: '/materials/', label: 'Материалы и инструкции'}
  ];

  topicRules
    .filter((rule) => rule.pattern.test(contextText))
    .slice(0, 2)
    .forEach((rule) => add(rule.href, rule.label));

  if(origin !== 'verified') add('/verification-guide/', 'Как портал проверяет сведения');
  if(links.length < 3) add('/residents/', 'Практические маршруты для жителей');
  add('/update-tos/', 'Передать новость или уточнение');

  return links.slice(0, 5);
}
function makePage(item, toses){
  const title = item.title || 'Новость ТОС БГО';
  const lead = item.lead || 'Новость портала ТОС Борисоглебского городского округа.';
  const id = item.id;
  const canonical = `${SITE_URL}/news/${id}/`;
  const articleImage = item.image || '';
  const socialImage = articleImage || '/assets/img/og-cover.svg';
  const socialImageFull = absoluteUrl(socialImage);
  const text = paragraphs(item.text, lead);
  const tos = item.tos_slug ? toses.find(t => t.slug === item.tos_slug) : null;
  const origin = inferContentOrigin(item, 'news');
  const originLabel = contentOriginLabel(origin);
  const originClass = contentOriginClass(origin);
  const originNotice = contentOriginNotice(origin, 'news');
  const contextLinks = buildContextLinks(item, tos, origin);
  const schema = {
    '@context':'https://schema.org',
    '@type':'NewsArticle',
    headline:title,
    description:lead,
    datePublished:item.date || '',
    dateModified:item.updated_at || item.date || '',
    image:socialImageFull,
    mainEntityOfPage:canonical,
    author:{'@type':'Organization',name:'Портал ТОС БГО',url:SITE_URL},
    publisher:{'@type':'Organization',name:'Портал ТОС БГО',url:SITE_URL}
  };
  if(item.source_url) schema.citation = absoluteUrl(item.source_url);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)} | ТОС БГО</title><meta name="description" content="${esc(lead)}"/><meta name="theme-color" content="#2f7d5a"/><link rel="canonical" href="${esc(canonical)}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(lead)}"/><meta property="og:type" content="article"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(socialImageFull)}"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="manifest" href="/site.webmanifest"/><link rel="stylesheet" href="/assets/css/styles.css"/><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/residents/">Жителям</a><a href="/partners/">Партнёрам</a><a href="/projects/">Проекты</a><a href="/done/">Сделано</a><a href="/needs/">Нужна помощь</a><a href="/documents/">Документы</a><a href="/contacts/">Контакты</a><a href="/sections/">Все разделы</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header><main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/news/">← Новости</a><div class="eyebrow">${esc(item.category || 'Новости')} · ${esc(dateRu(item.date))}</div><div class="meta"><span class="tag ${esc(originClass)}">${esc(originLabel)}</span></div><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p></div></section><section class="section tight"><div class="container notice"><b>Статус материала:</b> ${esc(originNotice)}</div></section><section class="section"><div class="container prose">${articleImage ? `<img src="${esc(articleImage)}" alt="${esc(item.image_alt || title)}" loading="lazy" style="width:100%;border-radius:24px;margin:18px 0;border:1px solid var(--line);">` : ''}${text.map(p => `<p>${esc(p)}</p>`).join('')}<hr class="sep"/><p class="source"><b>Источник:</b> ${esc(item.source || 'Редакция портала')}${sourceLink(item.source_url)}${implementationSource(item)}</p></div></section><section class="section tight" id="news-context" aria-labelledby="news-context-title"><div class="container prose"><h2 id="news-context-title">Что посмотреть дальше</h2><ul>${contextLinks.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('')}</ul><p class="tiny">Ссылки подобраны по теме и статусу материала и ведут только на действующие разделы портала.</p></div></section></main><footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница новости создана автоматически из data/news.json.</div></div></footer><script src="/assets/js/site.js"></script></body></html>`;
}
function updateSitemap(news){
  const today = new Date().toISOString().slice(0, 10);
  const urls = new Map();
  [
    '/', '/tos/', '/residents/', '/partners/', '/projects/', '/done/', '/needs/', '/documents/', '/contacts/', '/sections/', '/faq/', '/news/', '/grants/', '/calendar/', '/materials/', '/legal/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/editorial-policy/', '/search/'
  ].forEach((url) => addUrl(urls, url, today));

  readJson(TOSES_PATH).filter((item) => item.slug && isPublished(item)).forEach((item) => addUrl(urls, `/tos/${item.slug}/`, safeDate(item.updated_at) || today));
  news.filter((item) => item.id && isPublished(item)).forEach((item) => addUrl(urls, `/news/${item.id}/`, safeDate(item.updated_at) || safeDate(item.date) || today));
  readJson(ARTICLES_PATH).filter((item) => item.id && isPublished(item)).forEach((item) => addUrl(urls, `/materials/${item.id}/`, safeDate(item.date) || today));
  readJson(PROJECTS_PATH).filter((item) => item.id && isPublished(item)).forEach((item) => addUrl(urls, `/projects/${item.id}/`, today));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.entries()].map(([loc, lastmod]) => `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function main(){
  const news = readJson(NEWS_PATH).filter(n => n.id && isPublished(n));
  const toses = readJson(TOSES_PATH);
  news.forEach(item => write(path.join(ROOT, 'news', item.id, 'index.html'), makePage(item, toses)));
  updateSitemap(news);
  console.log(`Generated news pages: ${news.length}`);
}
main();
