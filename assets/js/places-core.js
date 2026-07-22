(function attachPlacesCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlacesCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPlacesCore() {
  const COUNT_FILTERS = new Set(['all', 'single', 'multiple']);
  const VERIFICATION_FILTERS = new Set(['all', 'verified', 'partial', 'review']);
  const SORT_OPTIONS = new Set(['name', 'count-desc', 'count-asc']);

  const DEFAULT_STATE = Object.freeze({
    q: '',
    count: 'all',
    verification: 'all',
    sort: 'name'
  });

  function normalize(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .trim();
  }

  function positiveInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function verificationGroup(item) {
    const verified = positiveInteger(item?.verifiedCount);
    const partial = positiveInteger(item?.partialCount);
    const review = positiveInteger(item?.reviewCount);
    const total = positiveInteger(item?.count);

    if (total > 0 && verified === total) return 'verified';
    if (verified > 0 || partial > 0) return 'partial';
    if (review > 0 || total > 0) return 'review';
    return 'review';
  }

  function sanitizeState(input = {}) {
    const count = COUNT_FILTERS.has(input.count) ? input.count : DEFAULT_STATE.count;
    const verification = VERIFICATION_FILTERS.has(input.verification)
      ? input.verification
      : DEFAULT_STATE.verification;
    const sort = SORT_OPTIONS.has(input.sort) ? input.sort : DEFAULT_STATE.sort;
    return {
      q: String(input.q || '').trim(),
      count,
      verification,
      sort
    };
  }

  function stateFromSearch(search = '') {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    return sanitizeState({
      q: params.get('q') || '',
      count: params.get('count') || DEFAULT_STATE.count,
      verification: params.get('verification') || DEFAULT_STATE.verification,
      sort: params.get('sort') || DEFAULT_STATE.sort
    });
  }

  function stateToSearch(input = {}) {
    const state = sanitizeState(input);
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.count !== DEFAULT_STATE.count) params.set('count', state.count);
    if (state.verification !== DEFAULT_STATE.verification) params.set('verification', state.verification);
    if (state.sort !== DEFAULT_STATE.sort) params.set('sort', state.sort);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function countMatches(item, filter) {
    const count = positiveInteger(item?.count);
    if (filter === 'single') return count === 1;
    if (filter === 'multiple') return count > 1;
    return true;
  }

  function verificationMatches(item, filter) {
    if (filter === 'all') return true;
    return verificationGroup(item) === filter;
  }

  function searchText(item) {
    return normalize([
      item?.name,
      item?.slug,
      item?.summary,
      ...(Array.isArray(item?.tosNames) ? item.tosNames : [])
    ].join(' '));
  }

  function comparePlaces(a, b, sort) {
    const nameDifference = String(a?.name || '').localeCompare(String(b?.name || ''), 'ru');
    if (sort === 'count-desc') {
      return positiveInteger(b?.count) - positiveInteger(a?.count) || nameDifference;
    }
    if (sort === 'count-asc') {
      return positiveInteger(a?.count) - positiveInteger(b?.count) || nameDifference;
    }
    return nameDifference;
  }

  function filterAndSort(items, input = {}) {
    const state = sanitizeState(input);
    const query = normalize(state.q);
    return (Array.isArray(items) ? items : [])
      .filter((item) => !query || searchText(item).includes(query))
      .filter((item) => countMatches(item, state.count))
      .filter((item) => verificationMatches(item, state.verification))
      .slice()
      .sort((a, b) => comparePlaces(a, b, state.sort));
  }

  function summary(items) {
    const list = Array.isArray(items) ? items : [];
    return list.reduce((result, item) => {
      const count = positiveInteger(item?.count);
      const group = verificationGroup(item);
      result.places += 1;
      result.toses += count;
      if (count === 1) result.single += 1;
      if (count > 1) result.multiple += 1;
      result[group] += 1;
      return result;
    }, {
      places: 0,
      toses: 0,
      single: 0,
      multiple: 0,
      verified: 0,
      partial: 0,
      review: 0
    });
  }

  function activeFilterCount(input = {}) {
    const state = sanitizeState(input);
    return Number(Boolean(state.q))
      + Number(state.count !== DEFAULT_STATE.count)
      + Number(state.verification !== DEFAULT_STATE.verification)
      + Number(state.sort !== DEFAULT_STATE.sort);
  }

  return {
    DEFAULT_STATE,
    activeFilterCount,
    filterAndSort,
    normalize,
    sanitizeState,
    stateFromSearch,
    stateToSearch,
    summary,
    verificationGroup
  };
}));
