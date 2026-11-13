const relations = require('../assets/js/collection-browser-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const view = require('../assets/js/resident-area-view');
const core = require('../assets/js/resident-area-core');
const read = name => JSON.parse(fs.readFileSync('data/' + name + '.json', 'utf8'));
const pick = (item, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(item, key)).map(key => [key, item[key]]));
const output = 'residents/my-area/index.html';
function dataForPage() {
  return {
    toses: read('toses').filter(core.publicItem).map(item => pick(item, ['slug', 'name', 'location', 'boundaries', 'trust', 'verification_status', 'verification_note'])),
    events: read('events').filter(core.publicItem).map(item => pick(item, ['id', 'status', 'date', 'time', 'title', 'description', 'place', 'tos_slug', 'tos_slugs', 'source', 'source_url', 'source_checked_at', 'content_origin'])),
    needs: read('needs').filter(core.publicItem).map(item => pick(item, ['id', 'status', 'date', 'tos_slug', 'tos_slugs', 'title', 'description', 'need_type', 'source', 'source_url', 'content_origin', 'source_checked_at', 'checked_at', 'valid_until', 'deadline'])),
    done: read('done').filter(item => core.publicItem(item) && item.content_origin === 'verified').map(item => pick(item, ['id', 'status', 'date', 'tos_slug', 'tos_slugs', 'title', 'summary', 'source_url', 'content_origin'])),
    news: read('news').filter(item => core.publicItem(item) && (item.content_origin === 'verified' || item.imported_from === 'vk') && relations.tosSlugs(item).length).map(item => pick(item, ['id', 'status', 'date', 'tos_slug', 'tos_slugs', 'title', 'lead', 'summary', 'description', 'source_url', 'content_origin', 'imported_from'])),
    scenarios: read('zhkh_routes').scenarios.map(item => pick(item, ['id', 'title']))
  };
}
function discovery(file, block, before) {
  let html = fs.readFileSync(file, 'utf8');
  const a = '<!-- resident-area:entry:start -->', b = '<!-- resident-area:entry:end -->';
  if (html.includes(a)) {
    const start = html.indexOf(a), end = html.indexOf(b, start); assert(end > start);
    html = html.slice(0, start) + a + block + b + html.slice(end + b.length);
  } else {
    assert(html.includes(before), 'Discovery marker missing: ' + file);
    html = html.replace(before, a + block + b + '\n' + before);
  }
  fs.writeFileSync(file, html);
}
function generate() {
  const data = dataForPage();
  const shell = fs.readFileSync('residents/index.html', 'utf8');
  const title = 'Моя территория — дела, события и помощь рядом | ТОС БГО';
  const description = 'Выберите ТОС Борисоглебского округа: контакты, карта, события, способы помочь, истории результата и инструкции по дому и двору. Без регистрации.';
  let before = shell.slice(0, shell.indexOf('<main id="main">'));
  before = before.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>')
    .replace(/(<meta name="description" content=")[^"]*/, '$1' + description)
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + title)
    .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + description)
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1https://tosborisoglebsk.ru/residents/my-area/')
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1https://tosborisoglebsk.ru/residents/my-area/')
    .replace(/(<meta name="theme-color" content=")[^"]*/, '$1#B62D36')
    .replace('</head>', '<link rel="stylesheet" href="/assets/css/resident-area.css"/></head>');
  const controls = `<div class="area-controls" data-area-controls hidden><div class="area-choice-grid"><div class="area-field"><label for="area-choice">Моя территория</label><select id="area-choice"><option value="">Весь Борисоглебский округ</option>${core.searchAreas(data.toses, '').map(item => `<option value="${view.esc(item.slug)}">${view.esc(item.name)} — ${view.esc(item.location)}</option>`).join('')}</select><span class="tiny">Список карточек портала; официальный состав и границы уточняются.</span></div><div class="area-field"><label for="area-search">Не знаете название? Найдите по улице или селу</label><input id="area-search" type="search" autocomplete="off" placeholder="Например: Чигорак или Северный" aria-describedby="area-search-note"/><span id="area-search-note" class="tiny">Поиск по опубликованному описанию, без определения вашего местоположения.</span><div class="area-search-results" data-area-found aria-live="polite"></div></div></div><div class="area-choice-actions"><button class="btn primary" type="button" data-area-save disabled>Запомнить мой ТОС</button><button class="btn" type="button" data-area-forget>Сбросить сохранённый выбор</button></div><p class="area-status" data-area-status role="status" aria-live="polite">Выбор можно сохранить только на этом устройстве. Учётная запись не нужна.</p><details class="area-share"><summary>Поделиться подборкой или распечатать</summary><div class="area-field"><label for="area-share-link">Ссылка для соседей</label><input id="area-share-link" data-area-share-link readonly value="https://tosborisoglebsk.ru/residents/my-area/"/></div><div class="card-actions"><button class="btn" type="button" data-area-share>Скопировать ссылку</button><button class="btn" type="button" data-area-print>Распечатать подборку</button></div></details></div>`;
  const directory = `<section data-area-directory><h2>Каталог территорий</h2><p>Откройте карточку, чтобы проверить контакты, описание границ и связанные материалы.</p><ul class="area-directory">${core.searchAreas(data.toses, '').map(item => `<li><a href="/tos/${view.esc(item.slug)}/"><b>ТОС «${view.esc(item.name)}»</b><span>${view.esc(item.location)}</span></a></li>`).join('')}</ul></section>`;
  const footer = shell.match(/<footer\b[\s\S]*?<\/footer>/)[0];
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = before + `<main id="main" class="resident-area"><section class="section"><div class="container" data-resident-area><div class="area-intro"><a class="chip" href="/residents/">← Жителям</a><p class="area-kicker">Люди. Территории. Развитие.</p><h1>Моя территория</h1><p class="lead">Дела вашего ТОС, события, способы помочь и ответы на вопросы дома и двора — в одной подборке.</p><p class="tiny">Сайт — информационный портал ТОС. Официальные обращения направляются напрямую ответственным организациям.</p></div>${controls}<noscript><p class="notice">Без JavaScript доступны каталог ниже, общие сроки и инструкции. Сведения конкретного ТОС откройте в его карточке.</p></noscript>${directory}<div data-area-dashboard>${view.dashboard(data, '')}</div><script type="application/json" id="resident-area-data">${json}</script></div></section></main>${footer}<script src="/assets/js/site.js" defer></script><script src="/assets/js/tos-catalog-core.js" defer></script><script src="/assets/js/collection-browser-core.js" defer></script><script src="/assets/js/resident-area-core.js" defer></script><script src="/assets/js/resident-area-view.js" defer></script><script src="/assets/js/resident-area.js" defer></script></body></html>\n`;
  fs.mkdirSync('residents/my-area', {recursive: true}); fs.writeFileSync(output, html);
  const entry = '<section class="section tight"><div class="container"><article class="card"><div class="card-inner"><span class="tag">Для вашей территории</span><h2>Дела своего ТОС — в одной подборке</h2><p>Выберите территорию: контакты, карта, события, помощь и истории результата. Выбор можно запомнить на устройстве, а ссылку отправить соседям.</p><a class="btn primary" href="/residents/my-area/">Открыть мою территорию</a></div></article></div></section>';
  discovery('residents/index.html', entry, '<section class="section tight" id="resident-quick-start">');
  discovery('sections/index.html', entry, '</main>');
  let residents = fs.readFileSync('residents/index.html', 'utf8');
  residents = residents.replace(/<b>\d+<\/b><span>ТОС(?:а|ов)? в каталоге<\/span>/, `<b>${data.toses.length}</b><span>ТОСов в каталоге</span>`);
  fs.writeFileSync('residents/index.html', residents);
  console.log(`Resident area generated: ${data.toses.length} TOS, ${data.done.length} sourced results; no new public facts`);
}
if (require.main === module) generate();
module.exports = {generate, dataForPage};
