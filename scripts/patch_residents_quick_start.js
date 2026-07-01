const fs = require('fs');
const path = require('path');

const patches = [
  {
    label: 'Residents quick start',
    pagePath: path.join(process.cwd(), 'residents', 'index.html'),
    existingId: 'id="resident-quick-start"',
    marker: '<section class="section"><div class="container section-head"><div><h2>Что можно сделать на сайте</h2>',
    block: '<section class="section tight" id="resident-quick-start"><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag ok">Быстрый старт</span><h2>Жителю достаточно начать с трёх шагов</h2><div class="grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Найдите свой ТОС</h3><p>Откройте каталог или карту, выберите территорию и проверьте карточку.</p><a class="btn" href="/tos/">Каталог ТОС</a></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Проверьте контакты</h3><p>Посмотрите председателя, открытые ссылки и статус сведений. Если есть ошибка, отправьте уточнение.</p><a class="btn" href="/update-tos/?type=card#message-builder">Уточнить карточку</a></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Выберите действие</h3><p>Сообщите потребность, предложите идею, помогите территории или пришлите фото результата.</p><a class="btn primary" href="/residents/action-routes/">Выбрать действие</a></div></article></div></div></article></div></section>\n\n'
  },
  {
    label: 'Chairperson quick start',
    pagePath: path.join(process.cwd(), 'chairperson', 'index.html'),
    existingId: 'id="chairperson-quick-start"',
    marker: '<section class="section">\n      <div class="container section-head"><div><h2>Практические инструкции председателю</h2>',
    block: '<section class="section tight" id="chairperson-quick-start"><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag ok">Быстрый старт</span><h2>Председателю достаточно начать с трёх действий</h2><div class="grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Проверьте карточку ТОС</h3><p>Сверьте название, председателя, контакты, открытые ссылки, границы и описание территории.</p><a class="btn" href="/chairperson/verify-card/">Как подтвердить</a></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Соберите вопросы жителей</h3><p>Запишите проблемы, идеи, потребности, фото и тех, кто готов помогать.</p><a class="btn" href="/update-tos/?type=need#message-builder">Добавить потребность</a></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Выберите рабочий маршрут</h3><p>Откройте маршрут председателя и выберите задачу: данные, собрание, проект, новость или конфликт.</p><a class="btn primary" href="/chairperson/action-routes/">Открыть маршрут</a></div></article></div></div></article></div></section>\n\n'
  }
];

function applyPatch(patch) {
  if (!fs.existsSync(patch.pagePath)) throw new Error(`Missing file: ${patch.pagePath}`);

  let html = fs.readFileSync(patch.pagePath, 'utf8');
  if (html.includes(patch.existingId)) {
    console.log(`${patch.label} already exists`);
    return;
  }

  if (!html.includes(patch.marker)) {
    throw new Error(`${patch.label} marker not found`);
  }

  html = html.replace(patch.marker, `${patch.block}${patch.marker}`);
  fs.writeFileSync(patch.pagePath, html, 'utf8');
  console.log(`Patched ${patch.label}`);
}

function main() {
  patches.forEach(applyPatch);
}

main();
