const fs=require('fs');
const path=require('path');
const {repoPathExists}=require('./lib/path_checks');

const root=process.cwd();
const pagePath=path.join(root,'tos','index.html');
const scriptPath=path.join(root,'assets','js','tos-catalog.js');
const corePath=path.join(root,'assets','js','tos-catalog-core.js');
const stylePath=path.join(root,'assets','css','tos-catalog.css');
const tosesPath=path.join(root,'data','toses.json');
const requiredControls=['catalog','tos-count','search','location-filter','type-filter','trust-filter','sort-filter','reset-filters','catalog-filter-status','tos-summary','tos-list'];
const removedControls=['contact-filter','activity-filter','fill-filter'];
const requiredRoutes=['/update-tos/','/contacts/','/sections/'];
const requiredCopy=['Каталог ТОС','Найдите свой ТОС','Каталог пополняется и уточняется','Не знаете, к какому ТОСу относитесь?','Поиск использует только опубликованные описательные сведения','Различайте даты','Требуют проверки','Сначала требующие внимания'];
const fallbackSlugs=['bogana','vostochnyy','gubari','ivanovka','podstepki','uyutnyy','chkalovec'];
function read(file){if(!fs.existsSync(file))throw new Error(`missing file ${file}`);return fs.readFileSync(file,'utf8');}
function need(errors,content,label,needle){if(!content.includes(needle))errors.push(`${label}: missing ${needle}`);}
function textMatch(content,pattern){const match=content.match(pattern);return match?match[1].trim():'';}
function main(){
  const errors=[];
  let html,script,core,css,toses;
  try{html=read(pagePath);script=read(scriptPath);core=read(corePath);css=read(stylePath);toses=JSON.parse(read(tosesPath));}catch(error){throw new Error(`TOS catalog content audit failed:\n${error.message}`);}
  const published=Array.isArray(toses)?toses.filter(item=>item&&item.status!=='draft'):[];
  const title=textMatch(html,/<title>([^<]+)<\/title>/i);
  const description=textMatch(html,/<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);
  if(!title.includes('Каталог ТОС')||!title.includes('Борисоглебского'))errors.push('catalog title must identify the district catalog');
  if(description.length<120||!description.includes('по названию')||!description.includes('проекты'))errors.push('catalog description must cover search and related content');
  need(errors,html,'catalog page','<link rel="canonical" href="https://tosborisoglebsk.ru/tos/"');
  requiredCopy.forEach(copy=>need(errors,html,'catalog page',copy));
  requiredControls.forEach(id=>need(errors,html,'catalog page',`id="${id}"`));
  removedControls.forEach(id=>{if(html.includes(`id="${id}"`))errors.push(`obsolete control remains: #${id}`);});
  ['/assets/css/tos-catalog.css','/assets/js/tos-catalog-core.js','/assets/js/tos-catalog.js','/assets/js/tos-logos.js'].forEach(asset=>need(errors,html,'catalog page',asset));
  if(html.indexOf('/assets/js/tos-catalog-core.js')>html.indexOf('/assets/js/tos-catalog.js'))errors.push('catalog core must load before UI script');
  requiredRoutes.forEach(route=>{if(!repoPathExists(route))errors.push(`linked route missing: ${route}`);need(errors,html,'catalog page',`href="${route}`);});
  if(html.includes('href="/map/"'))errors.push('empty map must not be promoted');
  const hero=html.match(/<div class="hero-actions">([\s\S]*?)<\/div>/);
  const heroLinks=hero?Array.from(hero[1].matchAll(/href="([^"]+)"/g),match=>match[1]):[];
  if(heroLinks.length!==2||heroLinks[0]!=='#catalog'||heroLinks[1]!=='/contacts/')errors.push(`unexpected hero links: ${heroLinks.join(', ')}`);
  const staticCount=Number(textMatch(html,/<b id="tos-count">(\d+)<\/b>/));
  if(staticCount!==published.length)errors.push(`static count mismatch: ${staticCount} !== ${published.length}`);
  fallbackSlugs.forEach(slug=>{if(!repoPathExists(`/tos/${slug}/`))errors.push(`missing route /tos/${slug}/`);need(errors,html,'noscript fallback',`/tos/${slug}/`);});
  need(errors,script,'catalog UI',"fetch('/data/toses.json'");
  ['/data/news.json','/data/projects.json','/data/done.json','/data/needs.json'].forEach(dataPath=>{if(script.includes(`fetch('${dataPath}'`))errors.push(`unrelated fetch found: ${dataPath}`);});
  ['TosCatalogCore','stateFromSearch','stateToSearch','filterAndSort','activeFilterCount','history.replaceState','updated_desc','attention','encodeURIComponent(t.slug)','?tos=${encodeURIComponent(t.slug)}&type=card#message-builder','Изменено на сайте','Проверено по источнику'].forEach(token=>need(errors,script,'catalog UI',token));
  if(/contacts_raw|emails\|\||phones\|\|/.test(core))errors.push('catalog core must not index contact values');
  ['searchText','stateFromSearch','stateToSearch','filterAndSort','attentionRank','formatDateRu'].forEach(token=>need(errors,core,'catalog core',token));
  ['verified','partial','needs_review','stale'].forEach(status=>{need(errors,html,'trust filter',`value="${status}"`);need(errors,core,'catalog core',`'${status}'`);});
  if(!script.includes('Проверка источника: дата, основание и объём не зафиксированы.'))errors.push('missing verification disclosure');
  if(script.includes('activityFor')||script.includes('activityBadges'))errors.push('unverified activity must not drive catalog cards');
  ['tos-toolbar','catalog-shortcuts','catalog-filter-status','improved-tos-card','tos-dates','feature-row','summary-grid'].forEach(selector=>need(errors,css,'catalog CSS',selector));
  if(!html.includes('data-action="menu"')||!html.includes('data-action="theme"'))errors.push('menu or theme control missing');
  if(errors.length)throw new Error(`TOS catalog content audit failed:\n${errors.join('\n')}`);
  console.log(`TOS catalog content OK: ${published.length} cards with URL filters and addressable corrections`);
}
main();