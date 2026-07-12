const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${relativePath}`);
  return { filePath, html: fs.readFileSync(filePath, 'utf8') };
}

function replaceHeroActions(html, h1, actionsHtml) {
  const h1Marker = `<h1>${h1}</h1>`;
  const h1Index = html.indexOf(h1Marker);
  if (h1Index === -1) throw new Error(`Missing H1 marker: ${h1}`);

  const start = html.indexOf('<div class="hero-actions">', h1Index);
  if (start === -1) throw new Error(`Missing hero actions after: ${h1}`);

  const end = html.indexOf('</div>', start);
  if (end === -1) throw new Error(`Unclosed hero actions after: ${h1}`);

  return `${html.slice(0, start)}<div class="hero-actions">${actionsHtml}</div>${html.slice(end + 6)}`;
}

function replaceSectionByHeading(html, heading, nextHeading, replacement) {
  const headingMarker = `<h2>${heading}</h2>`;
  const headingIndex = html.indexOf(headingMarker);
  if (headingIndex === -1) throw new Error(`Missing section heading: ${heading}`);

  const sectionStart = html.lastIndexOf('<section', headingIndex);
  if (sectionStart === -1) throw new Error(`Missing section start for: ${heading}`);

  const nextMarker = `<h2>${nextHeading}</h2>`;
  const nextHeadingIndex = html.indexOf(nextMarker, headingIndex + headingMarker.length);
  if (nextHeadingIndex === -1) throw new Error(`Missing next section heading: ${nextHeading}`);

  const nextSectionStart = html.lastIndexOf('<section', nextHeadingIndex);
  if (nextSectionStart <= sectionStart) throw new Error(`Invalid section boundary: ${heading}`);

  return `${html.slice(0, sectionStart)}${replacement}\n\n${html.slice(nextSectionStart)}`;
}

function replaceSectionById(html, id, replacement) {
  const idMarker = `id="${id}"`;
  const idIndex = html.indexOf(idMarker);
  if (idIndex === -1) throw new Error(`Missing section id: ${id}`);

  const sectionStart = html.lastIndexOf('<section', idIndex);
  if (sectionStart === -1) throw new Error(`Missing section start for id: ${id}`);

  const sectionEnd = html.indexOf('</section>', idIndex);
  if (sectionEnd === -1) throw new Error(`Missing section end for id: ${id}`);

  return `${html.slice(0, sectionStart)}${replacement}${html.slice(sectionEnd + 10)}`;
}

function writeIfChanged(filePath, previous, next, label) {
  if (previous === next) {
    console.log(`${label}: already focused`);
    return;
  }
  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`${label}: focused public scenario applied`);
}

function patchResidents() {
  const { filePath, html: original } = read('residents/index.html');
  let html = replaceHeroActions(
    original,
    'Как участвовать в жизни своей территории через ТОС',
    '<a class="btn primary" href="/residents/action-routes/">Выбрать действие</a><a class="btn" href="/tos/">Найти свой ТОС</a>'
  );

  const quickStart = '<section class="section tight" id="resident-quick-start"><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag ok">Главный маршрут</span><h2>Жителю достаточно начать с трёх шагов</h2><div class="grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Найдите свой ТОС</h3><p>Откройте каталог, выберите территорию и посмотрите статус карточки.</p><a class="btn" href="/tos/">Каталог ТОС</a></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Проверьте контакты</h3><p>Сверьте председателя и открытые ссылки. Если есть ошибка, передайте уточнение.</p><a class="btn" href="/update-tos/?type=card#message-builder">Уточнить карточку</a></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Выберите действие</h3><p>Сообщите о проблеме, предложите идею, помогите территории или передайте результат.</p><a class="btn primary" href="/residents/action-routes/">Выбрать действие</a></div></article></div><p class="tiny">Прямые формы: <a href="/update-tos/?type=need#message-builder">сообщить проблему</a> · <a href="/update-tos/?type=project#message-builder">предложить идею</a>.</p></div></article></div></section>';
  html = replaceSectionById(html, 'resident-quick-start', quickStart);

  const duplicateHeading = '<h2>Что можно сделать на сайте</h2>';
  if (html.includes(duplicateHeading)) {
    html = replaceSectionByHeading(html, 'Что можно сделать на сайте', 'Что ТОС может делать', '');
  }

  html = html.replace(
    'Начните с <a href="/tos/">каталога</a> и <a href="/map/">карты</a>.',
    'Начните с <a href="/tos/">каталога ТОС</a>.'
  );

  writeIfChanged(filePath, original, html, 'Residents');
}

function patchPartners() {
  const { filePath, html: original } = read('partners/index.html');
  let html = replaceHeroActions(
    original,
    'Помочь ТОСам можно конкретным делом',
    '<a class="btn primary" href="/partners/action-routes/">Выбрать формат помощи</a><a class="btn" href="/contacts/">Предложить ресурс</a>'
  );

  const mainRoute = '<section class="section" id="partner-main-route"><div class="container section-head"><div><h2>Как начать</h2><p>Как партнёру помочь ТОСам: четыре последовательных шага без неподтверждённых обещаний</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Выбрать потребность</h3><p>Найдите задачу и проверьте, что она ещё нужна территории.</p></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Уточнить детали</h3><p>Согласуйте получателя, объём, срок, доставку и условия передачи.</p></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Передать помощь</h3><p>Зафиксируйте факт передачи и ответственного за получение ресурса.</p></div></article><article class="card"><div class="card-inner"><span class="tag">4</span><h3>Показать результат</h3><p>После выполнения согласуйте фотоотчёт, упоминание и благодарность.</p></div></article></div></section>';
  html = replaceSectionByHeading(html, 'Как начать', 'Кто может стать партнёром', mainRoute);

  writeIfChanged(filePath, original, html, 'Partners');
}

function patchProjects() {
  const { filePath, html: original } = read('projects/index.html');
  let html = replaceHeroActions(
    original,
    'Банк идей для проектов ТОС',
    '<a class="btn primary" href="/projects/action-routes/">Подготовить проект</a><a class="btn" href="#projects-list">Смотреть идеи</a>'
  );

  const mainRoute = '<section class="section" id="project-main-route"><div class="container section-head"><div><h2>С чего начать</h2><p>Как превратить проблему в проект ТОС: сначала факты и жители, затем документы и поиск ресурса</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Описать проблему</h3><p>Укажите место, текущее состояние, кому мешает проблема и какой результат нужен.</p></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Обсудить с жителями</h3><p>Проверьте поддержку идеи, участников и готовность помогать.</p></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Собрать основу проекта</h3><p>Подготовьте фото, этапы, предварительную смету и ответственных.</p></div></article><article class="card"><div class="card-inner"><span class="tag">4</span><h3>Выбрать способ реализации</h3><p>Своими силами, с партнёром или через конкурс — после проверки условий и источников.</p></div></article></div></section>';
  html = replaceSectionByHeading(html, 'С чего начать', 'Быстрый выбор проекта', mainRoute);

  writeIfChanged(filePath, original, html, 'Projects');
}

patchResidents();
patchPartners();
patchProjects();
