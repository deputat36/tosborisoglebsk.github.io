const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'chairperson', 'index.html');
const marker = '<section class="section">\n      <div class="container section-head"><div><h2>Практические инструкции председателю</h2>';
const block = '<section class="section tight" id="chairperson-quick-start"><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag ok">Быстрый старт</span><h2>Председателю достаточно начать с трёх действий</h2><div class="grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Проверьте карточку ТОС</h3><p>Сверьте название, председателя, контакты, открытые ссылки, границы и описание территории.</p><a class="btn" href="/chairperson/verify-card/">Как подтвердить</a></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Соберите вопросы жителей</h3><p>Запишите проблемы, идеи, потребности, фото и тех, кто готов помогать.</p><a class="btn" href="/update-tos/?type=need#message-builder">Добавить потребность</a></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Выберите рабочий маршрут</h3><p>Откройте маршрут председателя и выберите задачу: данные, собрание, проект, новость или конфликт.</p><a class="btn primary" href="/chairperson/action-routes/">Открыть маршрут</a></div></article></div></div></article></div></section>\n\n';

function main() {
  if (!fs.existsSync(pagePath)) throw new Error(`Missing file: ${pagePath}`);

  let html = fs.readFileSync(pagePath, 'utf8');
  if (html.includes('id="chairperson-quick-start"')) {
    console.log('Chairperson quick start already exists');
    return;
  }

  if (!html.includes(marker)) {
    throw new Error('Chairperson quick start marker not found');
  }

  html = html.replace(marker, `${block}${marker}`);
  fs.writeFileSync(pagePath, html, 'utf8');
  console.log('Patched chairperson quick start');
}

main();
