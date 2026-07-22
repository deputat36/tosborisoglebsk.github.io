const placesCore = window.PlacesCore;

function placeCardsData(grid) {
  return [...grid.querySelectorAll('[data-place-slug]')].map((element) => ({
    element,
    slug: element.dataset.placeSlug || '',
    name: element.dataset.placeName || '',
    count: Number(element.dataset.placeCount || 0),
    verifiedCount: Number(element.dataset.placeVerified || 0),
    partialCount: Number(element.dataset.placePartial || 0),
    reviewCount: Number(element.dataset.placeReview || 0),
    summary: element.dataset.placeSummary || '',
    tosNames: (element.dataset.placeTosNames || '').split('|').filter(Boolean)
  }));
}

function renderPlacesSummary(items) {
  const root = document.querySelector('#places-summary');
  if (!root || !placesCore) return;
  const summary = placesCore.summary(items);
  root.innerHTML = `<div class="summary-grid" data-places-summary>
    <div class="summary-tile"><b>${summary.places}</b><span>территорий</span></div>
    <div class="summary-tile"><b>${summary.toses}</b><span>карточки ТОС</span></div>
    <div class="summary-tile"><b>${summary.multiple}</b><span>с несколькими ТОС</span></div>
    <div class="summary-tile"><b>${summary.verified}</b><span>полностью подтверждены</span></div>
    <div class="summary-tile"><b>${summary.review}</b><span>требуют проверки</span></div>
  </div>`;
}

function initializePlacesBrowser() {
  const grid = document.querySelector('#places-grid');
  if (!grid) return;
  if (!placesCore) {
    grid.insertAdjacentHTML('beforebegin', '<div class="container empty">Справочник не загрузился: отсутствует модуль фильтрации.</div>');
    return;
  }

  const search = document.querySelector('#place-search');
  const count = document.querySelector('#place-count-filter');
  const verification = document.querySelector('#place-verification-filter');
  const sort = document.querySelector('#place-sort');
  const reset = document.querySelector('#place-reset-filters');
  const status = document.querySelector('#place-filter-status');
  const empty = document.querySelector('#places-empty');
  const items = placeCardsData(grid);

  const initial = placesCore.stateFromSearch(location.search);
  if (search) search.value = initial.q;
  if (count) count.value = initial.count;
  if (verification) verification.value = initial.verification;
  if (sort) sort.value = initial.sort;

  renderPlacesSummary(items);

  function currentState() {
    return {
      q: search?.value || '',
      count: count?.value || 'all',
      verification: verification?.value || 'all',
      sort: sort?.value || 'name'
    };
  }

  function syncUrl(state) {
    history.replaceState(null, '', `${location.pathname}${placesCore.stateToSearch(state)}${location.hash || ''}`);
  }

  function apply() {
    const state = currentState();
    const filtered = placesCore.filterAndSort(items, state);
    const visible = new Set(filtered.map((item) => item.slug));

    filtered.forEach((item) => grid.appendChild(item.element));
    items.forEach((item) => {
      item.element.hidden = !visible.has(item.slug);
    });

    if (empty) empty.hidden = filtered.length > 0;
    if (status) {
      status.textContent = `Показано ${filtered.length} из ${items.length} территорий. Активных условий: ${placesCore.activeFilterCount(state)}.`;
    }
    syncUrl(state);
  }

  [search, count, verification, sort].forEach((element) => element?.addEventListener('input', apply));
  reset?.addEventListener('click', () => {
    if (search) search.value = '';
    if (count) count.value = 'all';
    if (verification) verification.value = 'all';
    if (sort) sort.value = 'name';
    apply();
    search?.focus();
  });
  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && search.value) {
      search.value = '';
      apply();
    }
  });

  apply();
}

initializePlacesBrowser();
