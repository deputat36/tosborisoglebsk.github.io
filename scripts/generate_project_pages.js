const fs = require('fs');
const path = require('path');
const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
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
function arr(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
function findTos(toses, slug){ return slug ? toses.find(t => t.slug === slug) : null; }
function desc(project){
  return project.description || `Проект ТОС: ${project.title || 'инициатива жителей'} — идея, этапы подготовки и возможная реализация.`;
}
function projectUpdateUrl(tos){
  const slug = tos?.slug ? `tos=${encodeURIComponent(tos.slug)}&` : '';
  return `/update-tos/?${slug}type=project#message-builder`;
}
function renderInfoBlock(title, text){
  return text ? `<div class="notice"><b style="color:var(--text)">${esc(title)}</b><br>${esc(text)}</div>` : '';
}
function makePage(project, toses){
  const id = project.id;
  const title = project.title || 'Проект ТОС';
  const type = project.type || 'Проект';
  const description = desc(project);
  const canonical = `${SITE_URL}/projects/${id}/`;
  const tos = findTos(toses, project.tos_slug);
  const steps = arr(project.steps);
  const grantLogic = project.grant_logic || '';
  const basedOn = project.based_on || '';
  const addProjectUrl = projectUpdateUrl(tos);
  const origin = inferContentOrigin(project, 'projects');
  const originLabel = contentOriginLabel(origin);
  const originClass = contentOriginClass(origin);
  const originNotice = contentOriginNotice(origin, 'projects');
  const schema = {
    '@context':'https://schema.org',
    '@type':'CreativeWork',
    name:title,
    description:description,
    url:canonical,
    about:type,
    provider:{'@type':'Organization',name:'Портал ТОС БГО'}
  };
  if(tos){
    schema.spatialCoverage = tos.location || 'Борисоглебский городской округ';
    schema.accountablePerson = tos.chairperson || undefined;
  }
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)} | Проекты ТОС БГО</title><meta name="description" content="${esc(description)}"/><meta name="theme-color" content="#2f7d5a"/><link rel="canonical" href="${esc(canonical)}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/><meta property="og:type" content="website"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${SITE_URL}/assets/img/og-cover.svg"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="manifest" href="/site.webmanifest"/><link rel="stylesheet" href="/assets/css/styles.css"/><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/news/">Новости</a><a href="/grants/">Конкурсы</a><a href="/projects/">Проекты</a><a href="/calendar/">Календарь</a><a href="/needs/">Нужна помощь</a><a href="/materials/">Материалы</a><a href="/documents/">Документы</a><a href="/create-tos/">Как создать ТОС</a><a href="/chairperson/">Председателю</a><a href="/contacts/">Контакты</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header><main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/projects/">← Проекты</a><div class="eyebrow">${esc(type)}</div><div class="meta"><span class="tag ${esc(originClass)}">${esc(originLabel)}</span></div><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="${esc(addProjectUrl)}">Предложить проект</a><a class="btn" href="/grants/">Конкурсы и гранты</a><a class="btn" href="/chairperson/">Председателю</a></div></div></section><section class="section tight"><div class="container notice"><b>Статус материала:</b> ${esc(originNotice)}</div></section><section class="section"><div class="container grid"><article class="card full"><div class="card-inner prose"><h2>О проекте</h2><p>${esc(description)}</p>${tos ? `<p><b>Связанный ТОС:</b> <a href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a></p>` : ''}${renderInfoBlock('Грантовая логика', grantLogic)}${renderInfoBlock('На чём основана идея', basedOn)}${steps.length ? `<h2>Этапы подготовки</h2><ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}<h2>Что подготовить для заявки</h2><ul><li>Короткое описание проблемы и территории.</li><li>Фотофиксацию текущего состояния.</li><li>Поддержку жителей: опрос, подписи, протокол или письма.</li><li>Предварительную смету с материалами, работами, доставкой и монтажом.</li><li>План дальнейшего содержания результата.</li><li>Фотоотчёт после реализации.</li></ul><hr class="sep"/><div class="card-actions"><a class="btn" href="/projects/">Все проекты</a>${tos ? `<a class="btn" href="/tos/${esc(tos.slug)}/">Открыть ТОС</a>` : ''}<a class="btn" href="/grants/">Конкурсы и гранты</a><a class="btn" href="${esc(addProjectUrl)}">Предложить проект</a></div></div></article></div></section></main><footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Страница проекта создана автоматически из data/projects.json.</div></div></footer><script src="/assets/js/site.js"></script></body></html>`;
}
function updateSitemap(projects){
  const staticUrls = ['/', '/tos/', '/news/', '/grants/', '/projects/', '/calendar/', '/needs/', '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/search/'].map(u => SITE_URL + u);
  const toses = readJson(TOSES_PATH).filter(t => t.slug && t.status !== 'draft').map(t => `${SITE_URL}/tos/${t.slug}/`);
  const projectUrls = projects.filter(p => p.id && p.status !== 'draft').map(p => `${SITE_URL}/projects/${p.id}/`);
  const urls = [...new Set([...staticUrls, ...toses, ...projectUrls])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function main(){
  const projects = readJson(PROJECTS_PATH).filter(p => p.id && p.status !== 'draft');
  const toses = readJson(TOSES_PATH);
  projects.forEach(project => write(path.join(ROOT, 'projects', project.id, 'index.html'), makePage(project, toses)));
  updateSitemap(projects);
  console.log(`Generated project pages: ${projects.length}`);
}
main();
