const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VERSION = '2026-07-22';
const CORE_SCRIPT = '<script src="/assets/js/collection-browser-core.js"></script>';

const replacements = [
  {
    path: 'news/index.html',
    script: 'news.js',
    before: '  <section class="section"><div class="container section-head"><div><h2>Все новости и материалы</h2><p>Фильтруйте ленту по теме, ТОСу или ключевому слову.</p></div><a class="btn" href="#send-news">Прислать новость</a></div><div class="container toolbar"><input class="input" id="news-search" placeholder="Поиск: субботник, грант, Богана, проект..." aria-label="Поиск новостей"/><select class="select" id="news-category-filter" aria-label="Фильтр новостей по теме"><option value="">Все темы</option></select><select class="select" id="news-tos-filter" aria-label="Фильтр новостей по ТОС"><option value="">Все ТОС</option></select></div></section>',
    after: `  <section class="section" data-collection-browser-version="${VERSION}"><div class="container section-head"><div><h2>Все новости и материалы</h2><p>Фильтруйте ленту по теме, ТОСу, происхождению материала или ключевому слову. Выбранные фильтры сохраняются в ссылке.</p></div><a class="btn" href="#send-news">Прислать новость</a></div><div class="container toolbar"><input class="input" id="news-search" placeholder="Поиск: субботник, грант, Богана, проект..." aria-label="Поиск новостей"/><select class="select" id="news-category-filter" aria-label="Фильтр новостей по теме"><option value="">Все темы</option></select><select class="select" id="news-tos-filter" aria-label="Фильтр новостей по ТОС"><option value="">Все ТОС</option></select><select class="select" id="news-origin-filter" aria-label="Фильтр новостей по происхождению материала"><option value="">Любое происхождение</option><option value="verified">Подтверждено источником</option><option value="editorial">Редакционный материал</option><option value="starter">Стартовый материал</option><option value="request">Запрос материалов</option></select><button class="btn" id="news-reset-filters" type="button">Сбросить фильтры</button></div><div class="container tos-summary" id="news-summary"><div class="empty">Загрузка сводки...</div></div><div class="container tiny" id="news-filter-status" role="status" aria-live="polite"></div></section>`
  },
  {
    path: 'projects/index.html',
    script: 'projects.js',
    before: '  <section class="section"><div class="container section-head"><div><h2>Идеи из банка проектов</h2><p>Карточки ниже загружаются автоматически из файла data/projects.json</p></div><a class="btn" href="/update-tos/?type=project#message-builder">Добавить проект</a></div><div class="container grid" id="projects-list"><div class="empty">Загрузка проектов...</div></div></section>',
    after: `  <section class="section" data-collection-browser-version="${VERSION}"><div class="container section-head"><div><h2>Идеи из банка проектов</h2><p>Фильтруйте идеи по типу, ТОСу и происхождению материала. Выбранное состояние сохраняется в ссылке.</p></div><a class="btn" href="/update-tos/?type=project#message-builder">Добавить проект</a></div><div class="container toolbar"><input class="input" id="projects-search" placeholder="Поиск: площадка, озеленение, памятник, спорт..." aria-label="Поиск проектов"/><select class="select" id="projects-type-filter" aria-label="Фильтр проектов по типу"><option value="">Все типы проектов</option></select><select class="select" id="projects-tos-filter" aria-label="Фильтр проектов по ТОС"><option value="">Все ТОС</option></select><select class="select" id="projects-origin-filter" aria-label="Фильтр проектов по происхождению материала"><option value="">Любое происхождение</option><option value="verified">Подтверждено источником</option><option value="editorial">Редакционный материал</option><option value="starter">Стартовая идея</option><option value="request">Запрос материалов</option></select><button class="btn" id="projects-reset-filters" type="button">Сбросить фильтры</button></div><div class="container tos-summary" id="projects-summary"><div class="empty">Загрузка сводки...</div></div><div class="container tiny" id="projects-filter-status" role="status" aria-live="polite"></div><div class="container list" id="projects-list"><div class="empty">Загрузка проектов...</div></div></section>`
  },
  {
    path: 'done/index.html',
    script: 'done.js',
    before: '    <section class="section"><div class="container section-head"><div><h2>Истории и материалы о результатах</h2><p>Фильтруйте по типу материала, ТОСу, году, наличию источника и деталям, которые ещё нужно уточнить</p></div><a class="btn" href="/update-tos/?type=photo#message-builder">Добавить историю</a></div><div class="container toolbar done-toolbar"><input class="input" id="done-search" placeholder="Поиск: площадка, памятник, водоснабжение, субботник..." aria-label="Поиск историй результата"/><select class="select" id="done-type-filter" aria-label="Фильтр историй по типу"><option value="">Все типы историй</option></select><select class="select" id="done-tos-filter" aria-label="Фильтр историй по ТОС"><option value="">Все ТОС</option></select><select class="select" id="done-year-filter" aria-label="Фильтр историй по году"><option value="">Все годы</option></select><select class="select" id="done-status-filter" aria-label="Фильтр историй по статусу"><option value="">Все статусы</option><option value="needs-details">Нужно уточнить детали</option><option value="has-participants">Есть участники</option><option value="has-source">Есть источник</option></select></div><div class="container tos-summary" id="done-summary"><div class="empty">Загрузка сводки...</div></div></section>',
    after: `    <section class="section" data-collection-browser-version="${VERSION}"><div class="container section-head"><div><h2>Истории и материалы о результатах</h2><p>Фильтруйте по типу, ТОСу, году, происхождению материала и полноте сведений. Выбранное состояние сохраняется в ссылке.</p></div><a class="btn" href="/update-tos/?type=photo#message-builder">Добавить историю</a></div><div class="container toolbar done-toolbar"><input class="input" id="done-search" placeholder="Поиск: площадка, памятник, водоснабжение, субботник..." aria-label="Поиск историй результата"/><select class="select" id="done-type-filter" aria-label="Фильтр историй по типу"><option value="">Все типы историй</option></select><select class="select" id="done-tos-filter" aria-label="Фильтр историй по ТОС"><option value="">Все ТОС</option></select><select class="select" id="done-year-filter" aria-label="Фильтр историй по году"><option value="">Все годы</option></select><select class="select" id="done-status-filter" aria-label="Фильтр историй по статусу"><option value="">Все статусы</option><option value="needs-details">Нужно уточнить детали</option><option value="has-participants">Есть участники</option><option value="has-source">Есть источник</option></select><select class="select" id="done-origin-filter" aria-label="Фильтр историй по происхождению материала"><option value="">Любое происхождение</option><option value="verified">Подтверждено источником</option><option value="editorial">Редакционный материал</option><option value="starter">Стартовый материал</option><option value="request">Запрос истории</option></select><button class="btn" id="done-reset-filters" type="button">Сбросить фильтры</button></div><div class="container tos-summary" id="done-summary"><div class="empty">Загрузка сводки...</div></div><div class="container tiny" id="done-filter-status" role="status" aria-live="polite"></div></section>`
  },
  {
    path: 'needs/index.html',
    script: 'needs.js',
    before: '    <section class="section"><div class="container section-head"><div><h2>Потребности и запросы</h2><p>Используйте поиск и фильтры, чтобы найти конкретный тип помощи, ТОС, статус или приоритет</p></div><a class="btn" href="/update-tos/?type=need#message-builder">Добавить потребность</a></div><div class="container toolbar"><input class="input" id="needs-search" placeholder="Поиск: саженцы, волонтёры, покраска, транспорт, фото..." aria-label="Поиск потребностей"/><select class="select" id="needs-type-filter" aria-label="Фильтр потребностей по типу помощи"><option value="">Все типы помощи</option></select><select class="select" id="needs-tos-filter" aria-label="Фильтр потребностей по ТОС"><option value="">Все ТОС</option></select><select class="select" id="needs-priority-filter" aria-label="Фильтр потребностей по приоритету"><option value="">Любой приоритет</option></select><select class="select" id="needs-status-filter" aria-label="Фильтр потребностей по статусу"><option value="">Любой статус</option><option value="active">Незакрытые</option><option value="closed">Закрытые</option><option value="partner">Для партнёров</option></select></div><div class="container tos-summary" id="needs-summary"><div class="empty">Загрузка сводки...</div></div></section>',
    after: `    <section class="section" data-collection-browser-version="${VERSION}"><div class="container section-head"><div><h2>Потребности и запросы</h2><p>Фильтруйте по типу помощи, ТОСу, статусу, приоритету и происхождению материала. Выбранное состояние сохраняется в ссылке.</p></div><a class="btn" href="/update-tos/?type=need#message-builder">Добавить потребность</a></div><div class="container toolbar"><input class="input" id="needs-search" placeholder="Поиск: саженцы, волонтёры, покраска, транспорт, фото..." aria-label="Поиск потребностей"/><select class="select" id="needs-type-filter" aria-label="Фильтр потребностей по типу помощи"><option value="">Все типы помощи</option></select><select class="select" id="needs-tos-filter" aria-label="Фильтр потребностей по ТОС"><option value="">Все ТОС</option></select><select class="select" id="needs-priority-filter" aria-label="Фильтр потребностей по приоритету"><option value="">Любой приоритет</option></select><select class="select" id="needs-status-filter" aria-label="Фильтр потребностей по статусу"><option value="">Любой статус</option><option value="active">Незакрытые</option><option value="closed">Закрытые</option><option value="partner">Для партнёров</option></select><select class="select" id="needs-origin-filter" aria-label="Фильтр потребностей по происхождению материала"><option value="">Любое происхождение</option><option value="verified">Подтверждено источником</option><option value="editorial">Редакционный материал</option><option value="starter">Стартовый материал</option><option value="request">Запрос данных</option></select><button class="btn" id="needs-reset-filters" type="button">Сбросить фильтры</button></div><div class="container tos-summary" id="needs-summary"><div class="empty">Загрузка сводки...</div></div><div class="container tiny" id="needs-filter-status" role="status" aria-live="polite"></div></section>`
  }
];

function patchPage(config) {
  const filePath = path.join(ROOT, config.path);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (!content.includes(`data-collection-browser-version="${VERSION}"`)) {
    if (!content.includes(config.before)) throw new Error(`${config.path}: collection toolbar marker not found`);
    content = content.replace(config.before, config.after);
    changed = true;
  }

  const pageScript = `<script src="/assets/js/${config.script}"></script>`;
  if (!content.includes(CORE_SCRIPT)) {
    if (!content.includes(pageScript)) throw new Error(`${config.path}: page script marker not found`);
    content = content.replace(pageScript, `${CORE_SCRIPT}\n${pageScript}`);
    changed = true;
  }

  if (changed) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function patchCollectionBrowsers() {
  const changed = replacements.reduce((total, config) => total + (patchPage(config) ? 1 : 0), 0);
  console.log(`Collection browser patch OK: ${replacements.length} pages checked, ${changed} updated`);
  return changed;
}

if (require.main === module) patchCollectionBrowsers();

module.exports = { patchCollectionBrowsers };
