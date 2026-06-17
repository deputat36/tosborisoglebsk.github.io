document.addEventListener('DOMContentLoaded', () => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const STORAGE_KEY = 'tos-collection-board-v1';
  const statuses = [
    ['not-started', 'Не начинали'],
    ['contacted', 'Написали'],
    ['waiting', 'Ждём ответ'],
    ['received', 'Получили данные'],
    ['done', 'Обновлено']
  ];

  let items = [];
  let filter = 'all';
  let state = loadState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (error) { return {}; }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getStatus(slug) {
    return state[slug]?.status || 'not-started';
  }

  function setStatus(slug, status) {
    state[slug] = { ...(state[slug] || {}), status, updatedAt: new Date().toISOString() };
    saveState();
    render();
  }

  function missingText(item) {
    return (item.missing || []).length ? (item.missing || []).join(', ') : 'проверка актуальности сведений';
  }

  function boardItems() {
    return items.filter((item) => {
      const status = getStatus(item.slug);
      if (filter === 'all') return true;
      if (filter === 'waiting') return ['contacted', 'waiting'].includes(status);
      if (filter === 'done') return ['received', 'done'].includes(status);
      return status === filter;
    }).sort((a, b) => {
      const ap = a.priority === 'Высокий' ? 0 : 1;
      const bp = b.priority === 'Высокий' ? 0 : 1;
      return ap - bp || (b.missing || []).length - (a.missing || []).length || String(a.name).localeCompare(String(b.name), 'ru');
    });
  }

  function renderStats() {
    const root = document.querySelector('#collection-stats');
    if (!root) return;
    const counts = statuses.reduce((acc, [key]) => ({ ...acc, [key]: 0 }), {});
    items.forEach((item) => { counts[getStatus(item.slug)] = (counts[getStatus(item.slug)] || 0) + 1; });
    const values = [
      ['Всего в работе', items.length],
      ['Не начинали', counts['not-started']],
      ['Написали', counts.contacted],
      ['Ждём ответ', counts.waiting],
      ['Получили данные', counts.received],
      ['Обновлено', counts.done]
    ];
    root.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value || 0)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function render() {
    renderStats();
    const root = document.querySelector('#collection-list');
    if (!root) return;
    const list = boardItems();
    if (!list.length) {
      root.innerHTML = '<div class="empty">По выбранному фильтру нет карточек.</div>';
      return;
    }
    root.innerHTML = list.map((item) => {
      const current = getStatus(item.slug);
      const options = statuses.map(([key, label]) => `<option value="${key}" ${key === current ? 'selected' : ''}>${esc(label)}</option>`).join('');
      const missing = (item.missing || []).slice(0, 8).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
      return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">${esc(item.location || '')}</span></div><h3>ТОС «${esc(item.name)}»</h3><p><b>Нужно уточнить:</b> ${esc(missingText(item))}</p><div>${missing}</div><label class="tiny" for="status-${esc(item.slug)}">Статус работы</label><select class="input" id="status-${esc(item.slug)}" data-board-status="${esc(item.slug)}">${options}</select><div class="card-actions"><a class="btn" href="/tos/${esc(item.slug)}/">Карточка</a><a class="btn" href="/data-requests/">Сообщение</a><a class="btn" href="/update-tos/?tos=${encodeURIComponent(item.slug || '')}">Обновить</a></div></article>`;
    }).join('');
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-board-status]');
    if (!select) return;
    setStatus(select.dataset.boardStatus, select.value);
  });

  document.querySelectorAll('[data-board-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.boardFilter || 'all';
      render();
    });
  });

  fetch('/data/tos_content_audit.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      items = (data?.items || []).filter((item) => item.priority === 'Высокий' || (item.missing || []).length);
      render();
    })
    .catch(() => {
      const root = document.querySelector('#collection-list');
      if (root) root.innerHTML = '<div class="empty">Не удалось загрузить аудит. Дождитесь автоматической генерации.</div>';
    });
});
