(function initCollectionBrowserCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CollectionBrowserCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCollectionBrowserCore() {
  const ORIGINS = Object.freeze(['verified', 'editorial', 'starter', 'request']);
  const ORIGIN_LABELS = Object.freeze({
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовый материал',
    request: 'Запрос материалов'
  });

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim().replace(/ё/g, 'е');
  }

  function normalizeOrigin(value, fallback = 'editorial') {
    return ORIGINS.includes(value) ? value : fallback;
  }

  function originLabel(origin, labels = {}) {
    const normalized = normalizeOrigin(origin);
    return labels[normalized] || ORIGIN_LABELS[normalized];
  }

  function parseState(search, fields) {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    return fields.reduce((state, field) => {
      state[field] = params.get(field) || '';
      return state;
    }, {});
  }

  function serializeState(state, fields) {
    const params = new URLSearchParams();
    fields.forEach((field) => {
      const value = String(state[field] || '').trim();
      if (value) params.set(field, value);
    });
    return params.toString();
  }

  function syncUrl(state, fields) {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    const query = serializeState(state, fields);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`;
    window.history.replaceState(null, '', next);
  }

  function readControls(controls) {
    return Object.entries(controls).reduce((state, [field, control]) => {
      state[field] = control ? String(control.value || '') : '';
      return state;
    }, {});
  }

  function applyControls(state, controls) {
    Object.entries(controls).forEach(([field, control]) => {
      if (control) control.value = state[field] || '';
    });
  }

  function resetControls(controls) {
    Object.values(controls).forEach((control) => {
      if (control) control.value = '';
    });
  }

  function activeFilterCount(state) {
    return Object.values(state).filter((value) => String(value || '').trim()).length;
  }

  function countOrigins(items, originResolver) {
    const counts = { verified: 0, editorial: 0, starter: 0, request: 0 };
    items.forEach((item) => {
      const origin = normalizeOrigin(originResolver(item));
      counts[origin] += 1;
    });
    return counts;
  }

  function setStatus(element, shown, total, active) {
    if (!element) return;
    element.textContent = `Показано ${shown} из ${total}. Активных фильтров: ${active}.`;
  }

  function bindControls(controls, callback) {
    Object.values(controls).forEach((control) => control?.addEventListener('input', callback));
  }

  return Object.freeze({
    ORIGINS,
    ORIGIN_LABELS,
    normalizeText,
    normalizeOrigin,
    originLabel,
    parseState,
    serializeState,
    syncUrl,
    readControls,
    applyControls,
    resetControls,
    activeFilterCount,
    countOrigins,
    setStatus,
    bindControls
  });
}));
