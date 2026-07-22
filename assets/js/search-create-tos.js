document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#site-search');
  const typeFilter = document.querySelector('#search-type-filter');
  const originFilter = document.querySelector('#search-origin-filter');
  const sortControl = document.querySelector('#search-sort');
  const resetButton = document.querySelector('#search-reset-filters');
  const summaryRoot = document.querySelector('#search-summary');
  const statusRoot = document.querySelector('#search-filter-status');
  const root = document.querySelector('#search-results');

  if (!input || !typeFilter || !originFilter || !sortControl || !resetButton || !summaryRoot || !statusRoot || !root) return;

  const CollectionCore = window.CollectionBrowserCore;
  const SearchCore = window.SearchBrowserCore;
  if (!CollectionCore || !SearchCore) {
    root.innerHTML = '<div class="empty">Поиск не загрузился: отсутствует служебный модуль.</div>';
    return;
  }

  const fields = ['q', 'type', 'origin', 'sort'];
  const controls = { q: input, type: typeFilter, origin: originFilter, sort: sortControl };
  const groupLabels = {};
  let pages = [];

  const quickLinks = [
    {
      type: 'Инструкция',
      title: 'Как создать ТОС в Борисоглебском городском округе',
      text: 'Пошаговый маршрут для инициативной группы жителей.',
      url: '/create-tos/'
    },
    {
      type: 'Комплект документов',
      title: 'Документы для создания ТОС',
      text: 'Рабочие шаблоны объявления, протокола, решений и устава.',
      url: '/documents/templates/tos-creation-kit/'
    },
    {
      type: 'Каталог',
      title: 'Найти свой ТОС',
      text: 'Поиск территории, карточки ТОС и способы сообщить уточнение.',
      url: '/tos/'
    },
    {
      type: 'Обновление данных',
      title: 'Сообщить исправление',
      text: 'Передать проверенные сведения, документ, новость или фотографию.',
      url: '/update-tos/'
    }
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function pathFromUrl(url) {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return url || '/';
    }
  }

  function originTag(page) {
    const origin = SearchCore.normalizeOrigin(page.content_origin) || 'reference';
    const label = SearchCore.ORIGIN_LABELS[origin];
    const className = origin === 'verified' ? 'ok' : origin === 'request' ? 'warn' : '';
    return `<span class="tag ${className}">${esc(label)}</span>`;
  }

  function pageCard(page) {
    const groupLabel = groupLabels[page.search_group] || page.section || 'Страница';
    return `<article class="list-item search-result" data-search-group="${esc(page.search_group)}" data-content-origin="${esc(page.content_origin)}">
      <div class="meta">
        <span class="tag">${esc(groupLabel)}</span>
        ${page.section && page.section !== groupLabel ? `<span class="tag">${esc(page.section)}</span>` : ''}
        ${originTag(page)}
      </div>
      <h3>${esc(page.title || 'Без названия')}</h3>
      <p>${esc(page.description || page.path || '')}</p>
      <a class="btn primary" href="${esc(pathFromUrl(page.url))}">Открыть</a>
    </article>`;
  }

  function renderSummary(items) {
    const counts = SearchCore.countOrigins(items);
    const review = counts.starter + counts.request;
    summaryRoot.innerHTML = `<div class="summary-grid">
      <div class="summary-tile"><b>${items.length}</b><span>страниц найдено</span></div>
      <div class="summary-tile"><b>${counts.reference}</b><span>справочные страницы</span></div>
      <div class="summary-tile"><b>${counts.verified}</b><span>подтверждено источником</span></div>
      <div class="summary-tile"><b>${counts.editorial}</b><span>редакционные материалы</span></div>
      <div class="summary-tile"><b>${review}</b><span>заготовки и запросы</span></div>
    </div>`;
  }

  function renderQuickLinks() {
    summaryRoot.innerHTML = '';
    statusRoot.textContent = 'Введите не менее двух символов или выберите фильтр.';
    root.innerHTML = `<div class="section-head"><div><h2>Быстрые ссылки</h2><p>Основные маршруты для жителей и инициативных групп</p></div></div>` + quickLinks.map((item) => `<article class="list-item search-result">
      <div class="meta"><span class="tag">${esc(item.type)}</span><span class="tag">Справочная страница</span></div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.text)}</p>
      <a class="btn primary" href="${esc(item.url)}">Открыть</a>
    </article>`).join('');
  }

  function currentState() {
    const state = CollectionCore.readControls(controls);
    state.sort = SearchCore.normalizeSort(state.sort);
    return state;
  }

  function apply({ sync = true } = {}) {
    const state = currentState();
    const query = SearchCore.normalizeText(state.q);
    const active = CollectionCore.activeFilterCount({
      q: state.q,
      type: state.type,
      origin: state.origin,
      sort: state.sort === 'relevance' ? '' : state.sort
    });

    if (sync) CollectionCore.syncUrl(state, fields);

    if (!query && !state.type && !state.origin && state.sort === 'relevance') {
      renderQuickLinks();
      return;
    }

    if (query && query.length < 2 && !state.type && !state.origin) {
      summaryRoot.innerHTML = '';
      statusRoot.textContent = 'Введите ещё один символ для поиска.';
      root.innerHTML = '<div class="empty">Поиск начинается с двух символов.</div>';
      return;
    }

    const filtered = SearchCore.filterPages(pages, state);
    const visible = filtered.slice(0, 60);
    renderSummary(filtered);
    statusRoot.textContent = `Показано ${visible.length} из ${filtered.length}. Активных фильтров: ${active}.`;
    root.innerHTML = visible.length
      ? visible.map(pageCard).join('')
      : '<div class="empty">Ничего не найдено. Измените запрос или сбросьте фильтры.</div>';
  }

  function populateTypes() {
    const current = typeFilter.value;
    const groups = SearchCore.availableGroups(pages)
      .sort((a, b) => String(groupLabels[a] || a).localeCompare(String(groupLabels[b] || b), 'ru'));
    typeFilter.innerHTML = '<option value="">Все типы страниц</option>'
      + groups.map((group) => `<option value="${esc(group)}">${esc(groupLabels[group] || group)}</option>`).join('');
    typeFilter.value = groups.includes(current) ? current : '';
  }

  function applyInitialState() {
    const state = CollectionCore.parseState(window.location.search, fields);
    state.origin = SearchCore.normalizeOrigin(state.origin);
    state.sort = SearchCore.normalizeSort(state.sort);
    CollectionCore.applyControls(state, controls);
  }

  fetch('/data/page_index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      pages = Array.isArray(data?.pages) ? data.pages : [];
      Object.assign(groupLabels, data?.search_groups || {});
      populateTypes();
      applyInitialState();
      apply({ sync: false });
    })
    .catch(() => {
      pages = [];
      root.innerHTML = '<div class="empty">Индекс поиска не загрузился. Попробуйте обновить страницу.</div>';
      statusRoot.textContent = 'Поиск временно недоступен.';
    });

  CollectionCore.bindControls(controls, () => apply());
  resetButton.addEventListener('click', () => {
    CollectionCore.resetControls(controls);
    sortControl.value = 'relevance';
    apply();
    input.focus();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      input.value = '';
      apply();
    }
  });
});
