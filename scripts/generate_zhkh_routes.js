const fs = require('node:fs');
const assert = require('node:assert/strict');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data = JSON.parse(fs.readFileSync('data/zhkh_routes.json', 'utf8'));
const articles = new Map(JSON.parse(fs.readFileSync('data/articles.json', 'utf8')).map(article=>[article.id,article]));
const channels = new Map(data.channels.map(channel=>[channel.id,channel]));
const sources = new Map(data.sources.map(source=>[source.id,source]));
const date = new Date(`${data.checked_at}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'});
const external = link => {
  assert.equal(new URL(link.url).protocol, 'https:');
  return `<a class="btn" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a>`;
};
function articleLink(id) {
  const article = articles.get(id); assert(article, `Unknown article: ${id}`);
  return `<a class="btn primary" href="/materials/${esc(id)}/">Открыть инструкцию</a>`;
}
function worksheetLink(name) {
  assert(/^[a-z-]+$/.test(name)); assert(fs.existsSync(`downloads/zhkh/${name}.txt`));
  return `<a class="btn" href="/downloads/zhkh/${esc(name)}.txt" download>Скачать рабочий лист</a>`;
}
function caseCard(item) {
  assert(/^[a-z-]+$/.test(item.id));
  assert(item.housing.length && item.housing.every(kind=>['mkd','house'].includes(kind)));
  const links = item.channel_ids.map(id=>{const channel=channels.get(id);assert(channel);return `<a class="btn" href="#zhkh-channel-${esc(id)}">${esc(channel.name)}</a>`;}).join('');
  return `<article class="card zhkh-case" id="zhkh-case-${item.id}" data-zhkh-case="${item.id}" data-housing="${item.housing.join(' ')}"><div class="card-inner"><span class="tag">${item.housing.length===2?'МКД и частный дом':'Только многоквартирный дом'}</span><h3>${esc(item.title)}</h3><details><summary>Первые шаги и адресат</summary><p><b>Сначала:</b> ${esc(item.first)}</p><p><b>Кому:</b> ${esc(item.recipient)}</p><h4>Что подготовить</h4><ul>${item.collect.map(text=>`<li>${esc(text)}</li>`).join('')}</ul><h4>Пример просьбы для доработки</h4><p>${esc(item.ask)}</p><p class="tiny">Добавьте факты и обязательные сведения по правилам адресата. Этот текст не отправляется и не является универсальной юридической претензией.</p><p><b>Как проверить результат:</b> ${esc(item.result)}</p><p><b>Чем поможет ТОС:</b> ${esc(item.tos)}</p><div class="card-actions">${articleLink(item.article)}${worksheetLink(item.worksheet)}${links}</div><p class="tiny">Тематическая основа: «Азбука ЖКХ» 4.0, страницы PDF ${esc(item.book_pages)}. Дополнительные источники и правовые ограничения — в инструкции.</p></details></div></article>`;
}
const navigator = `<section class="section zhkh-tools" id="zhkh-navigator" aria-labelledby="zhkh-navigator-title"><div class="container"><h2 id="zhkh-navigator-title">От вопроса к первому действию</h2><p>Выберите ситуацию: получите первые шаги, подсказку по адресату, рабочий лист и способ проверить результат. Личные сведения вводить не нужно.</p><div class="notice"><b>Есть опасность для жизни или нужна экстренная помощь?</b> Сначала звоните <a href="tel:112">112</a> или в профильную аварийную службу. Обычную заявку о качестве услуг направляйте своему исполнителю. ТОС и сайт не обеспечивают срочное реагирование.</div><div class="zhkh-filters" data-zhkh-controls hidden><div class="zhkh-field"><label id="zhkh-housing-label" for="zhkh-housing">Тип жилья</label><select id="zhkh-housing" aria-labelledby="zhkh-housing-label"><option value="all">Все варианты</option><option value="mkd">Квартира в МКД</option><option value="house">Частный дом</option></select></div><div class="zhkh-field"><label id="zhkh-issue-label" for="zhkh-issue">Ваш вопрос</label><select id="zhkh-issue" aria-labelledby="zhkh-issue-label"><option value="all">Показать все ситуации</option>${data.scenarios.map(item=>`<option value="${item.id}">${esc(item.title)}</option>`).join('')}</select></div><button class="btn" type="button" data-zhkh-reset>Сбросить выбор</button></div><p class="tiny" role="status" aria-live="polite" data-zhkh-status>Доступно маршрутов: ${data.scenarios.length}. Откройте нужную карточку.</p><p class="tiny" data-zhkh-house-note hidden>Для частного дома проверьте собственные договоры и границы имущества. Порядок управления общим имуществом МКД и региональный фонд капремонта МКД к нему не переносятся.</p><div class="zhkh-case-grid">${data.scenarios.map(caseCard).join('')}</div></div></section>`;
const local = `<section class="section zhkh-tools" id="local-help" aria-labelledby="zhkh-local-title"><div class="container"><h2 id="zhkh-local-title">Официальные ссылки для Борисоглебска</h2><p>Сначала определите предмет вопроса и ответственного. Организации по конкретному дому, договору и площадке могут различаться. Подборка источников: <time datetime="${data.checked_at}">${date}</time>.</p><div class="zhkh-case-grid">${data.channels.map(channel=>`<article class="card" id="zhkh-channel-${channel.id}"><div class="card-inner"><h3>${esc(channel.name)}</h3><p>${esc(channel.purpose)}</p><p>${esc(channel.steps)}</p><div class="card-actions">${channel.links.map(external).join('')}</div><details><summary>Источник сведений</summary><ul>${channel.source_ids.map(id=>{const source=sources.get(id);assert(source);return `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a><p class="tiny">${esc(source.basis)}</p></li>`;}).join('')}</ul></details></div></article>`).join('')}</div><p>Передавайте личные документы напрямую выбранному адресату. Публикация в ВК, запись в рабочем листе и отправка материала редакции портала не регистрируют официальное обращение.</p></div></section>`;
const lessons = `<section class="section zhkh-tools" id="tos-learning" aria-labelledby="zhkh-learning-title"><div class="container"><h2 id="zhkh-learning-title">Как использовать материалы на встречах ТОС</h2><p>Пример программы из четырёх коротких встреч. Выберите нужные темы для своей территории. Это предложение редакции для обучения, а не объявление о назначенных мероприятиях.</p><ol class="zhkh-lessons">${data.lessons.map(lesson=>`<li><h3>${esc(lesson.title)}</h3><p>${esc(lesson.task)}</p><p><b>Результат встречи:</b> ${esc(lesson.result)}</p><div class="card-actions">${articleLink(lesson.article)}${worksheetLink(lesson.worksheet)}</div></li>`).join('')}</ol><p>Для общей группы ВК подготовьте короткое приглашение, после встречи — обезличенный итог со ссылкой на инструкцию. Сохраните на сайте подтверждённый результат, чтобы к нему могли вернуться отсутствовавшие жители.</p><div class="card-actions"><a class="btn" href="/meeting-kit/">Подготовить встречу</a><a class="btn" href="/downloads/zhkh/public-update.txt">Заготовка итога для соседей</a></div></div></section>`;
const file = 'residents/zhkh/index.html';
let html = fs.readFileSync(file,'utf8');
function block(key, content, before) {
  const start=`<!-- zhkh:${key}:start -->`,end=`<!-- zhkh:${key}:end -->`;
  if(html.includes(start)) {
    const a=html.indexOf(start), b=html.indexOf(end);assert(b>a);
    html=html.slice(0,a+start.length)+content+html.slice(b);
  } else {
    assert(html.includes(before));html=html.replace(before,`${start}${content}${end}\n${before}`);
  }
}
block('navigator',navigator,'<section class="section" aria-labelledby="quick-start">');
block('local',local,'<section class="section" id="worksheets"');
block('learning',lessons,'<section class="section"><div class="container prose"><h2>Группа ВК и сайт работают вместе</h2>');
html=html.replace('href="#situations">Выбрать ситуацию','href="#zhkh-navigator">Выбрать ситуацию');
if(!html.includes('href="#local-help">'))html=html.replace('href="#worksheets">Скачать рабочие листы</a>','href="#worksheets">Скачать рабочие листы</a><a class="btn" href="#local-help">Официальные ссылки БГО</a><a class="btn" href="#tos-learning">Встречи ТОС по ЖКХ</a>');
if(!html.includes('/assets/css/zhkh-guide.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/zhkh-guide.css"/></head>');
if(!html.includes('/assets/js/zhkh-guide.js'))html=html.replace('</body>','<script src="/assets/js/zhkh-guide.js" defer></script>\n</body>');
html=html.replace(/<meta name="description" content="[^"]*"\/>/,'<meta name="description" content="Выберите вопрос по дому и ЖКХ: первые шаги для квартиры или частного дома, официальные ссылки БГО, 12 инструкций и 8 рабочих листов."/>');
fs.writeFileSync(file,html);
console.log(`ЖКХ: ${data.scenarios.length} маршрутов, ${data.channels.length} официальных направлений, ${data.lessons.length} темы встреч`);
