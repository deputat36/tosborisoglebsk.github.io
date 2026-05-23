const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
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
function makePage(item, toses){
  const title = item.title || 'Новость ТОС БГО';
  const lead = item.lead || 'Новость портала ТОС Борисоглебского городского округа.';
  const id = item.id;
  const canonical = `${SITE_URL}/news/${id}/`;
  const image = item.image || '/assets/img/og-cover.svg';
  const imageFull = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const text = paragraphs(item.text, lead);
  const tos = item.tos_slug ? toses.find(t => t.slug === item.tos_slug) : null;
  const schema = {
    '@context':'https://schema.org',
    '@type':'NewsArticle',
    headline:title,
    description:lead,
    datePublished:item.date || '',
    image:imageFull,
    mainEntityOfPage:canonical,
    author:{'@type':'Organization',name:item.source || 'Портал ТОС БГО'},
    publisher:{'@type':'Organization',name:'Портал ТОС БГО'}
  };
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)} | ТОС БГО</title><meta name="description" content="${esc(lead)}"/><meta name="theme-color" content="#2f7d5a"/><link rel="canonical" href="${esc(canonical)}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(lead)}"/><meta property="og:type" content="article"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(imageFull)}"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="manifest" href="/site.webmanifest"/><link rel="stylesheet" href="/assets/css/styles.css"/><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/news/">Новости</a><a href="/grants/">Конкурсы</a><a href="/projects/">Проекты</a><a href="/calendar/">Календарь</a><a href="/needs/">Нужна помощь</a><a href="/materials/">Материалы</a><a href="/documents/">Документы</a><a href="/contacts/">Контакты</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header><main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/news/">← Новости</a><div class="eyebrow">${esc(item.category || 'Новости')} · ${esc(dateRu(item.date))}</div><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p></div></section><section class="section"><div class="container prose">${image ? `<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" style="width:100%;border-radius:24px;margin:18px 0;border:1px solid var(--line);">` : ''}${text.map(p => `<p>${esc(p)}</p>`).join('')}${tos ? `<p><a class="btn" href="/tos/${esc(tos.slug)}/">Открыть связанный ТОС «${esc(tos.name)}»</a></p>` : ''}<hr class="sep"/><p class="source"><b>Источник:</b> ${esc(item.source || 'Редакция портала')}${item.source_url ? `<br><a href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(item.source_url)}</a>` : ''}</p></div></section></main><footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница новости создана автоматически из data/news.json.</div></div></footer><script src="/assets/js/site.js"></script></body></html>`;
}
function updateSitemap(news){
  const staticUrls = ['/', '/tos/', '/news/', '/grants/', '/projects/', '/calendar/', '/needs/', '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/search/'].map(u => SITE_URL + u);
  const toses = readJson(TOSES_PATH).filter(t => t.slug && t.status !== 'draft').map(t => `${SITE_URL}/tos/${t.slug}/`);
  const newsUrls = news.filter(n => n.id && n.status !== 'draft').map(n => `${SITE_URL}/news/${n.id}/`);
  const urls = [...new Set([...staticUrls, ...toses, ...newsUrls])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function main(){
  const news = readJson(NEWS_PATH).filter(n => n.id && n.status !== 'draft');
  const toses = readJson(TOSES_PATH);
  news.forEach(item => write(path.join(ROOT, 'news', item.id, 'index.html'), makePage(item, toses)));
  updateSitemap(news);
  console.log(`Generated news pages: ${news.length}`);
}
main();
