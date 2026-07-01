const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'assets', 'js', 'site.js');

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Не найден блок для обновления: ${label}`);
  return source.replace(pattern, replacement);
}

let js = fs.readFileSync(FILE, 'utf8');

const labelsBlock = `const SECTION_LABELS = {
  tos: 'Каталог ТОС',
  news: 'Новости',
  projects: 'Проекты',
  done: 'Сделано',
  needs: 'Нужна помощь',
  materials: 'Материалы',
  documents: 'Документы',
  legal: 'Правовая основа',
  places: 'Территории',
  chairperson: 'Председателю',
  residents: 'Жителям',
  partners: 'Партнёрам',
  grants: 'Конкурсы',
  calendar: 'Календарь',
  contacts: 'Контакты',
  search: 'Поиск',
  sections: 'Все разделы',
  'action-routes': 'Практические маршруты',
  sources: 'Источники данных',
  privacy: 'Публикация сведений',
  glossary: 'Словарь',
  methodology: 'Методика портала',
  workbench: 'Рабочая панель',
  'data-quality': 'Качество данных',
  'data-update': 'Актуализация данных',
  'data-requests': 'Запросы данных',
  'communication-kit': 'Коммуникационный набор',
  campaign: 'Кампания актуализации',
  'field-checklist': 'Чек-лист проверки',
  'media-guide': 'Фото и логотипы',
  'open-data': 'Открытые данные',
  roadmap: 'План развития',
  'site-index': 'Индекс страниц',
  'check-tos': 'Проверить ТОС',
  'submit-materials': 'Прислать материал',
  faq: 'Вопросы и ответы',
  'editorial-policy': 'О портале',
  'create-tos': 'Как создать ТОС',
  map: 'Карта'
};`;

const compactNavBlock = `function compactNav() {
  const nav = $('#site-nav');
  if (!nav) return;
  const links = [
    ['/tos/', 'Каталог ТОС'],
    ['/places/', 'Территории'],
    ['/action-routes/', 'Маршруты'],
    ['/residents/', 'Жителям'],
    ['/chairperson/', 'Председателю'],
    ['/projects/', 'Проекты'],
    ['/done/', 'Сделано'],
    ['/needs/', 'Нужна помощь'],
    ['/documents/', 'Документы'],
    ['/contacts/', 'Контакты'],
    ['/sections/', 'Все разделы']
  ];
  nav.innerHTML = links.map(([href, text]) => \`<a href="\${href}">\${text}</a>\`).join('');
}`;

const footerHtml = `<b>Полезные ссылки</b><br><a href="/sections/">Все разделы</a> · <a href="/action-routes/">Маршруты действий</a> · <a href="/workbench/">Рабочая панель</a> · <a href="/site-index/">Индекс страниц</a> · <a href="/faq/">Вопросы и ответы</a> · <a href="/sources/">Источники данных</a><br><a href="/data-quality/">Качество данных</a> · <a href="/data-requests/">Запросы данных</a> · <a href="/communication-kit/">Тексты для ВК</a> · <a href="/campaign/">Кампания</a> · <a href="/field-checklist/">Чек-лист</a><br><a href="/media-guide/">Фото и логотипы</a> · <a href="/places/">Территории</a> · <a href="/glossary/">Словарь ТОС</a> · <a href="/legal/federal-law-33/">ФЗ №33-ФЗ</a> · <a href="/privacy/">Публикация сведений</a><br><a href="/open-data/">Открытые данные</a> · <a href="/done/">Сделано ТОСами</a> · <a href="\${updateLink('card')}">Обновить данные ТОС</a> · <a href="/roadmap/">План развития</a> · <a href="https://vk.ru/tosbgo" target="_blank" rel="noopener">ВК-сообщество</a>`;

const homeBlock = `function injectHomePortalStatus() {
  const isHome = location.pathname === '/' || location.pathname === '/index.html';
  if (!isHome || $('#home-portal-status')) return;
  const main = $('#main');
  if (!main) return;
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'home-portal-status';
  section.innerHTML = \`<div class="container grid"><article class="card full"><div class="card-inner"><div class="eyebrow">Статус и доверие</div><h2>Как работает портал и кто может прислать материалы</h2><p>tosborisoglebsk.ru — информационный и рабочий портал для ТОСов Борисоглебского городского округа. Здесь можно найти карточки ТОС, новости, проекты, потребности, документы и практические маршруты для жителей, председателей, партнёров и инициативных групп.</p><div class="notice"><b style="color:var(--text)">Важно:</b> сайт не является официальным сайтом администрации. Для официальных действий нужно сверять документы, решения и правовую информацию с актуальными официальными источниками.</div><div class="grid"><article class="card"><div class="card-inner"><span class="tag">Жителю</span><h3>Найти свой ТОС</h3><p>Откройте каталог, выберите территорию и проверьте председателя, контакты, новости, потребности и сделанные дела.</p></div></article><article class="card"><div class="card-inner"><span class="tag">Председателю</span><h3>Прислать уточнение</h3><p>Можно отправить обновление карточки, новость, фотоотчёт, проект, потребность территории или сообщение об ошибке.</p></div></article></div><div class="card-actions"><a class="btn primary" href="/tos/">Найти свой ТОС</a><a class="btn" href="\${updateLink('card')}">Обновить данные</a><a class="btn" href="/action-routes/">Маршруты действий</a><a class="btn" href="/data-quality/">Качество данных</a><a class="btn" href="/sections/">Все разделы</a></div></div></article></div>\`;
  const stats = $('#home-stats')?.closest('section');
  if (stats) main.insertBefore(section, stats);
  else main.appendChild(section);
}`;

js = replaceOrFail(js, /const SECTION_LABELS = \{[\s\S]*?\n\};/, labelsBlock, 'SECTION_LABELS');
js = replaceOrFail(js, /function compactNav\(\) \{[\s\S]*?\n\}/, compactNavBlock, 'compactNav');
js = replaceOrFail(js, /box\.innerHTML = `[^`]*`;\n  footerGrid\.appendChild\(box\);/, `box.innerHTML = \`${footerHtml}\`;\n  footerGrid.appendChild(box);`, 'footer links');
js = replaceOrFail(js, /function injectHomePortalStatus\(\) \{[\s\S]*?\n\}/, homeBlock, 'home portal status');

fs.writeFileSync(FILE, js, 'utf8');
console.log('Patched site navigation and discovery links.');
