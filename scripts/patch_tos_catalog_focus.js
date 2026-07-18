const fs=require('fs');
const path=require('path');
const filePath=path.join(process.cwd(),'tos','index.html');
if(!fs.existsSync(filePath))throw new Error('Missing tos/index.html');
let html=fs.readFileSync(filePath,'utf8');
const original=html;
const currentMarkers=['id="sort-filter"','id="reset-filters"','id="catalog-filter-status"','data-catalog-trust="needs_review"','/assets/js/tos-catalog-core.js'];
if(currentMarkers.every(marker=>html.includes(marker))){
  if(html.includes('href="/map/"'))throw new Error('Catalog must not promote an empty map');
  console.log('Focused TOS catalog actuality controls already applied');
  process.exit(0);
}
function replaceIfPresent(oldValue,newValue){if(html.includes(oldValue))html=html.replace(oldValue,newValue);}
replaceIfPresent('<div class="hero-actions"><a class="btn primary" href="#catalog">Перейти к каталогу</a><a class="btn" href="/map/">Карта ТОС</a><a class="btn" href="/update-tos/?type=card#message-builder">Обновить данные</a><a class="btn" href="/contacts/">Не нашли свой ТОС?</a></div>','<div class="hero-actions"><a class="btn primary" href="#catalog">Найти свой ТОС</a><a class="btn" href="/contacts/">Не нашли свой ТОС?</a></div>');
const toolbarStart=html.indexOf('<div class="container toolbar tos-toolbar">');
const summaryStart=html.indexOf('<div class="container tos-summary"',toolbarStart);
if(toolbarStart===-1||summaryStart===-1)throw new Error('Catalog toolbar boundary not found');
const shortcuts='<div class="container catalog-shortcuts" aria-label="Быстрые режимы каталога"><button class="btn" type="button" data-catalog-trust="needs_review">Требуют проверки</button><button class="btn" type="button" data-catalog-sort="attention">Сначала требующие внимания</button><span class="tiny">Изменение фильтров автоматически отражается в ссылке.</span></div>';
const toolbar='<div class="container toolbar tos-toolbar"><input class="input" id="search" type="search" placeholder="Улица, село, микрорайон, название ТОС или председатель..." aria-label="Поиск ТОС по опубликованным сведениям" aria-describedby="catalog-search-help"/><select class="select" id="location-filter" aria-label="Фильтр ТОС по территории"><option value="">Все территории</option></select><select class="select" id="type-filter" aria-label="Фильтр ТОС по типу"><option value="">Все типы</option><option>Городской</option><option>Сельский</option></select><select class="select" id="trust-filter" aria-label="Фильтр ТОС по статусу проверки"><option value="">Статус проверки: все</option><option value="verified">Подтверждены источником</option><option value="partial">Проверены частично</option><option value="needs_review">Требуют проверки</option><option value="stale">Нужно перепроверить</option></select><select class="select" id="sort-filter" aria-label="Сортировка карточек"><option value="name">По названию</option><option value="updated_desc">Недавно изменённые</option><option value="attention">Требующие внимания</option></select><button class="btn" id="reset-filters" type="button">Сбросить</button></div><div class="container catalog-filter-status tiny" id="catalog-filter-status" role="status" aria-live="polite">Загрузка каталога…</div>';
html=`${html.slice(0,toolbarStart)}${shortcuts}${toolbar}${html.slice(summaryStart)}`;
if(!html.includes('/assets/js/tos-catalog-core.js'))html=html.replace('<script src="/assets/js/tos-catalog.js"></script>','<script src="/assets/js/tos-catalog-core.js"></script>\n  <script src="/assets/js/tos-catalog.js"></script>');
if(html.includes('href="/map/"'))throw new Error('Catalog must not promote an empty map');
fs.writeFileSync(filePath,html,'utf8');
console.log(html===original?'Focused TOS catalog already applied':'Focused TOS catalog actuality controls patched');