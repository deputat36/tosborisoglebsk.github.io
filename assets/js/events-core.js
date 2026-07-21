(function initEventsCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EventsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createEventsCore() {
  const PERIODS = new Set(['upcoming', 'all', 'today', 'future', 'past', 'undated']);
  const SOURCES = new Set(['', 'external', 'editorial', 'unconfirmed']);

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase().replace(/ё/g, 'е');
  }

  function localDayValue(value) {
    if (!value) return Number.NaN;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return date.getTime();
  }

  function todayValue(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  function dateState(item, now = new Date()) {
    const value = localDayValue(item?.date);
    if (Number.isNaN(value)) return { key: 'undated', label: 'дата уточняется', className: 'warn' };
    const today = todayValue(now);
    if (value < today) return { key: 'past', label: 'дата прошла', className: '' };
    if (value === today) return { key: 'today', label: 'дата сегодня', className: 'warn' };
    return { key: 'future', label: 'дата впереди', className: '' };
  }

  function sourceKind(item) {
    const source = normalize(item?.source);
    if (source.includes('редакция портала')) return 'editorial';
    if (String(item?.source_url || '').trim()) return 'external';
    return 'unconfirmed';
  }

  function sourceLabel(kind) {
    return ({
      external: 'есть внешний источник',
      editorial: 'рабочая дата редакции',
      unconfirmed: 'источник нужно уточнить'
    })[kind] || 'источник нужно уточнить';
  }

  function sourceNotice(kind) {
    if (kind === 'external') {
      return 'Перед участием проверьте дату, условия, место и возможные изменения на странице источника.';
    }
    if (kind === 'editorial') {
      return 'Это рабочая контрольная точка редакции, а не официальный дедлайн или подтверждённый анонс события.';
    }
    return 'Источник и актуальность даты нужно уточнить до публикации анонса, поездки или подготовки заявки.';
  }

  function stateFromSearch(search = '') {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const period = params.get('period') || 'upcoming';
    const source = params.get('source') || '';
    return {
      q: params.get('q') || '',
      type: params.get('type') || '',
      tos: params.get('tos') || '',
      period: PERIODS.has(period) ? period : 'upcoming',
      source: SOURCES.has(source) ? source : ''
    };
  }

  function stateToSearch(state = {}) {
    const params = new URLSearchParams();
    const q = String(state.q || '').trim();
    const type = String(state.type || '').trim();
    const tos = String(state.tos || '').trim();
    const period = PERIODS.has(state.period) ? state.period : 'upcoming';
    const source = SOURCES.has(state.source) ? state.source : '';
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (tos) params.set('tos', tos);
    if (period !== 'upcoming') params.set('period', period);
    if (source) params.set('source', source);
    const value = params.toString();
    return value ? `?${value}` : '';
  }

  function matchesPeriod(item, period, now) {
    const key = dateState(item, now).key;
    if (period === 'all') return true;
    if (period === 'upcoming') return key === 'today' || key === 'future';
    return key === period;
  }

  function eventTimestamp(item) {
    const date = String(item?.date || '9999-12-31');
    const time = String(item?.time || '00:00');
    return `${date}T${time}`;
  }

  function filterAndSort(events, state = {}, options = {}) {
    const now = options.now || new Date();
    const tosName = typeof options.tosName === 'function' ? options.tosName : () => '';
    const query = normalize(state.q);
    const period = PERIODS.has(state.period) ? state.period : 'upcoming';
    const source = SOURCES.has(state.source) ? state.source : '';

    return (Array.isArray(events) ? events : [])
      .filter((item) => item && item.status !== 'draft')
      .filter((item) => !state.type || item.type === state.type)
      .filter((item) => !state.tos || item.tos_slug === state.tos)
      .filter((item) => !source || sourceKind(item) === source)
      .filter((item) => matchesPeriod(item, period, now))
      .filter((item) => {
        if (!query) return true;
        const date = dateState(item, now);
        const kind = sourceKind(item);
        const haystack = [
          item.title,
          item.description,
          item.type,
          item.place,
          item.source,
          tosName(item.tos_slug),
          date.label,
          sourceLabel(kind)
        ].map(normalize).join(' ');
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aState = dateState(a, now).key;
        const bState = dateState(b, now).key;
        const rank = { today: 0, future: 1, undated: 2, past: 3 };
        const rankDifference = rank[aState] - rank[bState];
        if (rankDifference) return rankDifference;
        if (aState === 'past') return eventTimestamp(b).localeCompare(eventTimestamp(a));
        return eventTimestamp(a).localeCompare(eventTimestamp(b));
      });
  }

  function summary(events, now = new Date()) {
    const published = (Array.isArray(events) ? events : []).filter((item) => item && item.status !== 'draft');
    const result = {
      total: published.length,
      upcoming: 0,
      today: 0,
      future: 0,
      past: 0,
      undated: 0,
      external: 0,
      editorial: 0,
      unconfirmed: 0
    };
    published.forEach((item) => {
      const dateKey = dateState(item, now).key;
      result[dateKey] += 1;
      if (dateKey === 'today' || dateKey === 'future') result.upcoming += 1;
      result[sourceKind(item)] += 1;
    });
    return result;
  }

  function activeFilterCount(state = {}) {
    return [state.q, state.type, state.tos, state.source, state.period && state.period !== 'upcoming']
      .filter(Boolean).length;
  }

  return {
    normalize,
    dateState,
    sourceKind,
    sourceLabel,
    sourceNotice,
    stateFromSearch,
    stateToSearch,
    filterAndSort,
    summary,
    activeFilterCount
  };
});
