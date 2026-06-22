const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const ARTICLES_PATH = path.join(ROOT, 'data', 'articles.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
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
function arr(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
function compactText(value, maxLength){
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const boundary = sliced.lastIndexOf(' ');
  const base = sliced.slice(0, boundary > 50 ? boundary : sliced.length).replace(/[,:;.!?\s]+$/u, '');
  return `${base}…`;
}
function lead(article){
  return article.lead || arr(article.content)[0] || 'Полезный материал для председателей и активистов ТОС Борисоглебского городского округа.';
}
function desc(article){
  const text = [article.lead, ...arr(article.content)].filter(Boolean).join(' ') || lead(article);
  return compactText(text, 155);
}
function makePage(article){
  const id = article.id;
  const title = article.title || 'Материал ТОС БГО';
  const category = article.category || 'Материалы';
  const description = desc(article);
  const visibleLead = lead(article);
  const canonical = `${SITE_URL}/materials/${id}/`;
  const content = arr(article.content);
  const schema = {
    '@context':'https://schema.org',
    '@type':'Article',
    headline:title,
    description:description,
    articleSection:category,
    mainEntityOfPage:canonical,
    author:{'@type':'Organization',name:'Портал ТОС БГО'},
    publisher:{'@type':'Organization',name:'Портал ТОС БГО'}
  };
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)} | Материалы ТОС БГО</title><meta name="description" content="${esc(description)}"/><meta name="theme-color" content="#2f7d5a"/><link rel="canonical" href="${esc(canonical)}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/><meta property="og:type" content="article"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${SITE_URL}/assets/img/og-cover.svg"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="manifest" href="/site.webmanifest"/><link rel="stylesheet" href="/assets/css/styles.css"/><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/news/">Новости</a><a href="/grants/">Конкурсы</a><a href="/projects/">Проекты</a><a href="/calendar/">Календарь</a><a href="/needs/">Нужна помощь</a><a href="/materials/">Материалы</a><a href="/documents/">Документы</a><a href="/create-tos/">Как создать ТОС</a><a href="/contacts/">Контакты</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header><main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/materials/">← Материалы</a><div class="eyebrow">${esc(category)}</div><h1>${esc(title)}</h1><p class="lead">${esc(visibleLead)}</p></div></section><section class="section"><div class="container prose">${content.length ? content.map(p => `<p>${esc(p)}</p>`).join('') : '<p>Материал готовится к публикации.</p>'}<hr class="sep"/><div class="card-actions"><a class="btn" href="/materials/">Все материалы</a><a class="btn" href="/documents/">Документы</a><a class="btn" href="/create-tos/">Как создать ТОС</a></div></div></section></main><footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница материала создана автоматически из data/articles.json.</div></div></footer><script src="/assets/js/site.js"></script></body></html>`;
}
function updateSitemap(articles){
  const staticUrls = ['/', '/tos/', '/news/', '/grants/', '/projects/', '/calendar/', '/needs/', '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/search/'].map(u => SITE_URL + u);
  const toses = readJson(TOSES_PATH).filter(t => t.slug && t.status !== 'draft').map(t => `${SITE_URL}/tos/${t.slug}/`);
  const news = readJson(NEWS_PATH).filter(n => n.id && n.status !== 'draft').map(n => `${SITE_URL}/news/${n.id}/`);
  const projects = readJson(PROJECTS_PATH).filter(p => p.id && p.status !== 'draft').map(p => `${SITE_URL}/projects/${p.id}/`);
  const materialUrls = articles.filter(a => a.id && a.status !== 'draft').map(a => `${SITE_URL}/materials/${a.id}/`);
  const urls = [...new Set([...staticUrls, ...toses, ...news, ...projects, ...materialUrls])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function main(){
  const articles = readJson(ARTICLES_PATH).filter(a => a.id && a.status !== 'draft');
  articles.forEach(article => write(path.join(ROOT, 'materials', article.id, 'index.html'), makePage(article)));
  updateSitemap(articles);
  console.log(`Generated material pages: ${articles.length}`);
}
main();
