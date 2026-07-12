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
  done: 'Результаты',
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
  map: 'Состояние геоданных'
};`;

const compactNavBlock = `function compactNav() {
  const nav = $('#site-nav');
  if (!nav) return;
  const links = [
    ['/tos/', 'Каталог ТОС'],
    ['/residents/', 'Жителям'],
    ['/chairperson/', 'Председателю'],
    ['/projects/', 'Проекты'],
    ['/documents/', 'Документы'],
    ['/contacts/', 'Контакты'],
    ['/sections/', 'Все разделы']
  ];
  nav.innerHTML = links.map(([href, text]) => \`<a href="\${href}">\${text}</a>\`).join('');
}`;

const footerHtml = `<b>Основные разделы</b><br><a href="/tos/">Каталог ТОС</a> · <a href="/residents/">Жителям</a> · <a href="/chairperson/">Председателю</a> · <a href="/projects/">Проекты</a> · <a href="/documents/">Документы</a> · <a href="/contacts/">Контакты</a><br><a href="/editorial-policy/">О портале</a> · <a href="/sources/">Источники данных</a> · <a href="/data-quality/">Качество данных</a> · <a href="/sections/">Все разделы</a> · <a href="https://vk.ru/tosbgo" target="_blank" rel="noopener">ВК-сообщество</a><br><span class="tiny">Редакционные инструменты собраны отдельно: <a href="/workbench/">рабочая панель</a>.</span>`;

const homeBlock = `function injectHomePortalStatus() {
  // Главная уже содержит обязательный статус рабочей версии в исходном HTML.
  // Дополнительный программный блок не вставляется, чтобы не перегружать публичную оболочку.
  return;
}`;

js = replaceOrFail(js, /const SECTION_LABELS = \{[\s\S]*?\n\};/, labelsBlock, 'SECTION_LABELS');
js = replaceOrFail(js, /function compactNav\(\) \{[\s\S]*?\n\}/, compactNavBlock, 'compactNav');
js = replaceOrFail(js, /box\.innerHTML = `[^`]*`;\n  footerGrid\.appendChild\(box\);/, `box.innerHTML = \`${footerHtml}\`;\n  footerGrid.appendChild(box);`, 'footer links');
js = replaceOrFail(js, /function injectHomePortalStatus\(\) \{[\s\S]*?\n\}/, homeBlock, 'home portal status');

fs.writeFileSync(FILE, js, 'utf8');
console.log('Patched simplified public navigation and footer.');
