const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'residents', 'index.html');
const marker = '<section class="section"><div class="container section-head"><div><h2>Что можно сделать на сайте</h2>';
const block = '<section class="section tight" id="resident-quick-start"><div class="container grid"><article class="card full highlight-card"><div class="card-inner"><span class="tag ok">Быстрый старт</span><h2>Жителю достаточно начать с трёх шагов</h2><div class="grid"><article class="card"><div class="card-inner"><span class="tag">1</span><h3>Найдите свой ТОС</h3><p>Откройте каталог или карту, выберите территорию и проверьте карточку.</p><a class="btn" href="/tos/">Каталог ТОС</a></div></article><article class="card"><div class="card-inner"><span class="tag">2</span><h3>Проверьте контакты</h3><p>Посмотрите председателя, открытые ссылки и статус сведений. Если есть ошибка, отправьте уточнение.</p><a class="btn" href="/update-tos/?type=card#message-builder">Уточнить карточку</a></div></article><article class="card"><div class="card-inner"><span class="tag">3</span><h3>Выберите действие</h3><p>Сообщите потребность, предложите идею, помогите территории или пришлите фото результата.</p><a class="btn primary" href="/residents/action-routes/">Выбрать действие</a></div></article></div></div></article></div></section>\n\n';

function main() {
  if (!fs.existsSync(pagePath)) throw new Error(`Missing file: ${pagePath}`);

  let html = fs.readFileSync(pagePath, 'utf8');
  if (html.includes('id="resident-quick-start"')) {
    console.log('Residents quick start already exists');
    return;
  }

  if (!html.includes(marker)) {
    throw new Error('Residents quick start marker not found');
  }

  html = html.replace(marker, `${block}${marker}`);
  fs.writeFileSync(pagePath, html, 'utf8');
  console.log('Patched residents quick start');
}

main();
