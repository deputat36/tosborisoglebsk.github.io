(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TosMaterials = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TOPICS = Object.freeze({
    start: 'Создание и управление ТОС',
    residents: 'Жители и собрания',
    projects: 'Проекты, сметы и конкурсы',
    team: 'Команда и партнёры',
    reports: 'Публикации и отчёты',
    territory: 'Территория и опыт',
    other: 'Другие материалы'
  });
  const CATEGORY_TOPICS = Object.freeze({
    'Создание ТОС': 'start', 'Инструкция': 'start', 'Председателю': 'start', 'Председателю ТОС': 'start', 'Документы': 'start',
    'Вовлечение': 'residents', 'Собрания': 'residents', 'Работа с жителями': 'residents',
    'Проекты': 'projects', 'Гранты': 'projects', 'Конкурс ТОС': 'projects', 'Смета': 'projects', 'Идеи проектов': 'projects',
    'Команда ТОС': 'team', 'Партнёрства': 'team', 'НКО и партнёрство': 'team', 'Потребности': 'team',
    'Отчётность': 'reports', 'Фотоотчёт': 'reports', 'Публичность и отчётность': 'reports', 'Соцсети': 'reports', 'Коммуникации': 'reports',
    'Карта': 'territory', 'Проверка территории': 'territory', 'Практики Воронежской области': 'territory', 'Развитие территории': 'territory', 'Справка': 'territory'
  });
  function normalize(value) { return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function href(value) {
    const text = String(value || '').trim();
    if (!text || /[\\\u0000-\u0020]/.test(text) || text.startsWith('//')) return '';
    try {
      const url = new URL(text, 'https://tosborisoglebsk.ru');
      if (url.protocol !== 'https:') return '';
      return text.startsWith('/') ? url.pathname + url.search + url.hash : url.href;
    } catch { return ''; }
  }
  function destination(value) {
    const url = new URL(value, 'https://tosborisoglebsk.ru');
    return url.origin + url.pathname.replace(/\/$/, '') + url.search;
  }
  function buildCatalog(curated = [], articles = []) {
    const result = [];
    const byUrl = new Map();
    function add(item, article) {
      if (!item || item.status === 'draft' || item.status === 'archived') return;
      const url = href(item.url);
      if (!url || !String(item.title || '').trim()) return;
      const key = destination(url);
      const previous = byUrl.get(key);
      const text = [item.title, item.category, item.description, item.audience, ...(item.tags || []), ...(article?.content || []), ...(article?.sections || []).flatMap(section => [section.title, ...(section.paragraphs || []), ...(section.items || [])])].filter(Boolean).join(' ');
      if (previous) {
        previous.search = normalize(previous.search + ' ' + text);
        if (article) previous.kind = 'article';
        return;
      }
      const row = { ...item, url, kind: article ? 'article' : 'section', topic: TOPICS[item.topic] ? item.topic : CATEGORY_TOPICS[item.category] || 'other', search: normalize(text) };
      byUrl.set(key, row);
      result.push(row);
    }
    (Array.isArray(curated) ? curated : []).forEach(item => add(item));
    (Array.isArray(articles) ? articles : []).forEach(article => {
      if (!article || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.id || '')) return;
      add({ ...article, url: `/materials/${article.id}/`, description: article.lead || article.content?.[0] || '', audience: article.audience || 'Председатели и активисты', tags: article.tags || [] }, article);
    });
    return result;
  }
  function matches(item, state = {}) {
    const words = normalize(state.q).split(' ').filter(Boolean);
    return (!state.topic || item.topic === state.topic) && words.every(word => normalize(item.search).includes(word));
  }
  function relevance(item, query) {
    const title = normalize(item.title), category = normalize(item.category), description = normalize(item.description);
    return normalize(query).split(' ').filter(Boolean).reduce((sum, word) => sum + (title.includes(word) ? 12 : 0) + (category.includes(word) ? 6 : 0) + (description.includes(word) ? 3 : 0), 0);
  }
  function render(item) {
    const url = href(item.url);
    if (!url) return '';
    const target = /^https:\/\//.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    const kind = item.kind === 'article' ? 'Статья' : 'Рабочий раздел';
    const label = item.kind === 'article' ? 'Читать' : 'Открыть раздел';
    return `<article class="card" data-material-id="${esc(item.id)}" data-material-topic="${esc(item.topic)}" data-material-search="${esc(item.search)}"><div class="card-inner"><div class="meta"><span class="tag">${esc(item.category)}</span><span class="tiny">${kind}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="tiny">Для кого: ${esc(item.audience)}</div><div class="card-actions"><a class="btn primary" href="${esc(url)}"${target} aria-label="${label}: ${esc(item.title)}">${label}</a></div></div></article>`;
  }
  return Object.freeze({ TOPICS, buildCatalog, normalize, matches, relevance, render });
}));
