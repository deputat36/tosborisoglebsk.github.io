document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#site-search');
  const typeFilter = document.querySelector('#search-type-filter');
  const originFilter = document.querySelector('#search-origin-filter');
  const sortControl = document.querySelector('#search-sort');
  const resetButton = document.querySelector('#search-reset-filters');
  const summaryRoot = document.querySelector('#search-summary');
  const statusRoot = document.querySelector('#search-filter-status');
  const root = document.querySelector('#search-results');
  const toolbar = document.querySelector('#search-controls');
  const moreButton = document.querySelector('#search-more-results');
  const retryButton = document.querySelector('#search-retry');

  if (!input || !typeFilter || !originFilter || !sortControl || !resetButton || !summaryRoot || !statusRoot || !root) return;

  const CollectionCore = window.CollectionBrowserCore;
  const SearchCore = window.SearchBrowserCore;
  if (!CollectionCore || !SearchCore) {
    statusRoot.textContent = 'Поиск по словам сейчас недоступен. Обновите страницу или откройте разделы ниже.';
    return;
  }

  const fields = ['q', 'type', 'origin', 'sort'];
  const controls = { q: input, type: typeFilter, origin: originFilter, sort: sortControl };
  const groupLabels = {};
  const batchSize = 60;
  let pages = [];
  let visibleLimit = batchSize;
  let loadState = 'idle';
  let pendingType = '';

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

  function quickLinkCards() {
    return `<div class="section-head"><div><h2>Быстрые ссылки</h2><p>Основные маршруты для жителей и инициативных групп</p></div></div>` + quickLinks.map((item) => `<article class="list-item search-result">
      <div class="meta"><span class="tag">${esc(item.type)}</span><span class="tag">Справочная страница</span></div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.text)}</p>
      <a class="btn primary" href="${esc(item.url)}">Открыть</a>
    </article>`).join('');
  }

  function renderQuickLinks() {
    summaryRoot.innerHTML = '';
    statusRoot.textContent = 'Введите не менее двух символов или выберите фильтр.';
    root.innerHTML = quickLinkCards();
  }

  function currentState() {
    const state = CollectionCore.readControls(controls);
    if (loadState !== 'ready') state.type = pendingType;
    state.sort = SearchCore.normalizeSort(state.sort);
    return state;
  }

  function apply({ sync = true, resetLimit = true } = {}) {
    if (resetLimit) visibleLimit = batchSize;
    const state = currentState();
    const query = SearchCore.normalizeText(state.q);
    const active = CollectionCore.activeFilterCount({
      q: state.q,
      type: state.type,
      origin: state.origin,
      sort: state.sort === 'relevance' ? '' : state.sort
    });

    if (sync) CollectionCore.syncUrl(state, fields);
    if (moreButton) moreButton.hidden = true;
    if (retryButton) retryButton.hidden = loadState !== 'error';
    root.setAttribute('aria-busy', String(loadState === 'loading'));

    if (loadState !== 'ready') {
      summaryRoot.innerHTML = '';
      statusRoot.textContent = loadState === 'error'
        ? 'Поиск временно недоступен. Повторите загрузку или откройте раздел ниже.'
        : 'Загружаем поиск. Можно ввести запрос или открыть раздел ниже.';
      root.innerHTML = (loadState === 'error'
        ? '<div class="empty">Не удалось загрузить поиск. Ваш запрос и фильтры сохранены.</div>' : '') + quickLinkCards();
      return;
    }

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
    const visible = filtered.slice(0, visibleLimit);
    renderSummary(filtered);
    statusRoot.textContent = `Показано ${visible.length} из ${filtered.length}. Активных фильтров: ${active}.`;
    root.innerHTML = visible.length
      ? visible.map(pageCard).join('')
      : '<div class="empty">Ничего не найдено. Измените запрос или сбросьте фильтры.</div>';
    if (moreButton && visible.length < filtered.length) {
      moreButton.hidden = false;
      moreButton.textContent = 'Показать ещё ' + Math.min(batchSize, filtered.length - visible.length);
    }
  }

  function populateTypes() {
    const current = loadState === 'ready' ? typeFilter.value : pendingType;
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
    pendingType = state.type;
    state.q = state.q.slice(0, 200);
    CollectionCore.applyControls(state, controls);
  }

  async function loadIndex() {
    if (loadState === 'loading') return;
    loadState = 'loading';
    typeFilter.disabled = true;
    if (retryButton) retryButton.disabled = true;
    apply({ sync: false });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/data/page_index.json', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Search index HTTP error');
      const data = await response.json();
      if (!Array.isArray(data?.pages) || !data.pages.length) throw new Error('Search index is empty or invalid');
      pages = data.pages;
      Object.assign(groupLabels, data?.search_groups || {});
      populateTypes();
      loadState = 'ready';
      typeFilter.disabled = false;
      apply({ sync: false });
    } catch {
      pages = [];
      loadState = 'error';
      apply({ sync: false });
    } finally {
      clearTimeout(timer);
      if (retryButton) retryButton.disabled = false;
    }
  }

  CollectionCore.bindControls(controls, () => apply());
  resetButton.addEventListener('click', () => {
    CollectionCore.resetControls(controls);
    pendingType = '';
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
  moreButton?.addEventListener('click', () => {
    const firstNew = visibleLimit;
    visibleLimit += batchSize;
    apply({ sync: false, resetLimit: false });
    root.querySelectorAll('.search-result a.btn')[firstNew]?.focus();
  });
  retryButton?.addEventListener('click', loadIndex);
  window.addEventListener('popstate', () => {
    applyInitialState();
    apply({ sync: false });
  });
  applyInitialState();
  if (toolbar) toolbar.hidden = false;
  loadIndex();
});
