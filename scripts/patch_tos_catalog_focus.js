const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'tos', 'index.html');
if (!fs.existsSync(filePath)) throw new Error('Missing tos/index.html');

let html = fs.readFileSync(filePath, 'utf8');
const original = html;

function replaceOrKeep(oldValue, newValue, label) {
  if (html.includes(newValue)) return;
  if (!html.includes(oldValue)) throw new Error(`Missing catalog marker: ${label}`);
  html = html.replace(oldValue, newValue);
}

replaceOrKeep(
  '<div class="hero-actions"><a class="btn primary" href="#catalog">Перейти к каталогу</a><a class="btn" href="/map/">Карта ТОС</a><a class="btn" href="/update-tos/?type=card#message-builder">Обновить данные</a><a class="btn" href="/contacts/">Не нашли свой ТОС?</a></div>',
  '<div class="hero-actions"><a class="btn primary" href="#catalog">Найти свой ТОС</a><a class="btn" href="/contacts/">Не нашли свой ТОС?</a></div>',
  'hero actions'
);

replaceOrKeep(
  '<div class="home-panel"><div class="home-panel-item"><b>Ищите по улице</b><span>введите название улицы, села, микрорайона или председателя</span></div><div class="home-panel-item"><b>Смотрите активность</b><span>у карточек видно, есть ли новости, проекты, потребности и результаты</span></div><div class="home-panel-item"><b>Помогайте обновлять</b><span>если данные устарели, отправьте исправление через форму</span></div></div>',
  '<div class="home-panel"><div class="home-panel-item"><b>Ищите по территории</b><span>введите улицу, село, микрорайон, название ТОС или фамилию председателя</span></div><div class="home-panel-item"><b>Смотрите статус проверки</b><span>карточка отдельно показывает, подтверждены ли сведения источником</span></div><div class="home-panel-item"><b>Сообщайте исправления</b><span>если опубликованные сведения устарели, передайте уточнение редакции</span></div></div>',
  'hero panel'
);

replaceOrKeep(
  '<section class="section tight"><div class="container notice"><b>Не знаете, к какому ТОСу относитесь?</b> Попробуйте поиск по улице, населённому пункту или фамилии председателя. Если не получилось — напишите через контакты портала, и данные можно будет уточнить.</div></section>',
  '<section class="section tight" id="catalog-search-help"><div class="container notice"><b>Не знаете, к какому ТОСу относитесь?</b> Начните с улицы, населённого пункта, микрорайона или фамилии председателя. Поиск использует только опубликованные сведения и не заменяет официальный документ о границах. Если результата нет — <a href="/contacts/">сообщите адрес редакции</a>.</div></section>',
  'search help'
);

html = html.replace(
  'Используйте фильтры, чтобы быстро найти нужную территорию.',
  'Начните с поиска по адресу или названию, затем при необходимости уточните территорию, тип или статус проверки.'
);

const toolbarStart = html.indexOf('<div class="container toolbar tos-toolbar">');
const summaryStart = html.indexOf('<div class="container tos-summary"', toolbarStart);
if (toolbarStart === -1 || summaryStart === -1) throw new Error('Catalog toolbar boundary not found');

const focusedToolbar = '<div class="container toolbar tos-toolbar"><input class="input" id="search" placeholder="Улица, село, микрорайон, название ТОС или председатель..." aria-label="Поиск ТОС по опубликованным сведениям" aria-describedby="catalog-search-help"/><select class="select" id="location-filter" aria-label="Фильтр ТОС по территории"><option value="">Все территории</option></select><select class="select" id="type-filter" aria-label="Фильтр ТОС по типу"><option value="">Все типы</option><option>Городской</option><option>Сельский</option></select><select class="select" id="trust-filter" aria-label="Фильтр ТОС по статусу проверки"><option value="">Статус проверки: все</option><option value="verified">Подтверждены источником</option><option value="partial">Проверены частично</option><option value="needs_review">Требуют проверки</option><option value="stale">Нужно перепроверить</option></select></div>';
html = `${html.slice(0, toolbarStart)}${focusedToolbar}${html.slice(summaryStart)}`;

if (html.includes('href="/map/"')) {
  throw new Error('Focused catalog must not promote an empty map');
}

if (html !== original) {
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Focused TOS catalog page patched');
} else {
  console.log('Focused TOS catalog page already applied');
}
