(function initSearchBrowserCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SearchBrowserCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSearchBrowserCore() {
  const ORIGINS = Object.freeze(['reference', 'verified', 'editorial', 'starter', 'request']);
  const ORIGIN_LABELS = Object.freeze({
    reference: 'Справочная страница',
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовый материал',
    request: 'Запрос материалов'
  });
  const SORTS = Object.freeze(['relevance', 'title', 'section']);

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function normalizeOrigin(value) {
    return ORIGINS.includes(value) ? value : '';
  }

  function normalizeSort(value) {
    return SORTS.includes(value) ? value : 'relevance';
  }

  function scorePage(page, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 0;

    const title = normalizeText(page.title);
    const description = normalizeText(page.description);
    const section = normalizeText(page.section);
    const path = normalizeText(page.path);
    const group = normalizeText(page.search_group);
    const haystack = [title, description, section, path, group].join(' ');
    const tokens = normalizedQuery.split(' ').filter(Boolean);

    if (!tokens.every((token) => haystack.includes(token))) return -1;

    let score = 0;
    if (title === normalizedQuery) score += 140;
    else if (title.startsWith(normalizedQuery)) score += 100;
    else if (title.includes(normalizedQuery)) score += 75;

    tokens.forEach((token) => {
      if (title.includes(token)) score += 18;
      if (section.includes(token)) score += 8;
      if (description.includes(token)) score += 5;
      if (path.includes(token)) score += 2;
    });
    return score;
  }

  function compareText(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'ru');
  }

  function filterPages(pages, state = {}) {
    const query = normalizeText(state.q);
    const group = String(state.type || '');
    const origin = normalizeOrigin(state.origin);
    const sort = normalizeSort(state.sort);

    const matched = (Array.isArray(pages) ? pages : [])
      .filter((page) => !group || page.search_group === group)
      .filter((page) => !origin || page.content_origin === origin)
      .map((page) => ({ page, score: scorePage(page, query) }))
      .filter((entry) => !query || entry.score >= 0);

    matched.sort((a, b) => {
      if (sort === 'relevance' && query && a.score !== b.score) return b.score - a.score;
      if (sort === 'section') {
        return compareText(a.page.section, b.page.section) || compareText(a.page.title, b.page.title);
      }
      return compareText(a.page.title, b.page.title);
    });

    return matched.map((entry) => entry.page);
  }

  function countOrigins(pages) {
    const counts = { reference: 0, verified: 0, editorial: 0, starter: 0, request: 0 };
    (Array.isArray(pages) ? pages : []).forEach((page) => {
      const origin = ORIGINS.includes(page.content_origin) ? page.content_origin : 'reference';
      counts[origin] += 1;
    });
    return counts;
  }

  function availableGroups(pages) {
    return [...new Set((Array.isArray(pages) ? pages : []).map((page) => page.search_group).filter(Boolean))];
  }

  return Object.freeze({
    ORIGINS,
    ORIGIN_LABELS,
    SORTS,
    normalizeText,
    normalizeOrigin,
    normalizeSort,
    scorePage,
    filterPages,
    countOrigins,
    availableGroups
  });
}));
