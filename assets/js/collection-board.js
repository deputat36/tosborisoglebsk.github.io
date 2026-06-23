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
  const statusMap = Object.fromEntries(statuses);

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

  function getNote(slug) {
    return state[slug]?.note || '';
  }

  function setStatus(slug, status) {
    state[slug] = { ...(state[slug] || {}), status, updatedAt: new Date().toISOString() };
    saveState();
    render();
  }

  function setNote(slug, note) {
    state[slug] = { ...(state[slug] || {}), note, updatedAt: new Date().toISOString() };
    saveState();
    renderStats();
  }

  function missingText(item) {
    return (item.missing || []).length ? (item.missing || []).join(', ') : 'проверка актуальности сведений';
  }

  function updateUrl(slug) {
    return `/update-tos/?tos=${encodeURIComponent(slug || '')}&type=card#message-builder`;
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
    const withNotes = items.filter((item) => getNote(item.slug)).length;
    const values = [
      ['Всего в работе', items.length],
      ['Не начинали', counts['not-started']],
      ['Написали', counts.contacted],
      ['Ждём ответ', counts.waiting],
      ['Получили данные', counts.received],
      ['Обновлено', counts.done],
      ['С заметками', withNotes]
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
      const note = getNote(item.slug);
      const slug = String(item.slug || '');
      const urlSlug = encodeURIComponent(slug);
      const attrSlug = esc(slug);
      const options = statuses.map(([key, label]) => `<option value="${esc(key)}" ${key === current ? 'selected' : ''}>${esc(label)}</option>`).join('');
      const missing = (item.missing || []).slice(0, 8).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
      return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">${esc(item.location || '')}</span></div><h3>ТОС «${esc(item.name)}»</h3><p><b>Нужно уточнить:</b> ${esc(missingText(item))}</p><div>${missing}</div><label class="tiny" for="status-${attrSlug}">Статус работы</label><select class="input" id="status-${attrSlug}" data-board-status="${attrSlug}">${options}</select><label class="tiny" for="note-${attrSlug}">Рабочая заметка</label><textarea class="input" id="note-${attrSlug}" data-board-note="${attrSlug}" rows="2" placeholder="Например: написали председателю 18.06, ждём логотип">${esc(note)}</textarea><div class="card-actions"><a class="btn" href="/tos/${urlSlug}/">Карточка</a><a class="btn" href="/data-requests/">Сообщение</a><a class="btn" href="/workbench/">Черновик</a><a class="btn primary" href="${updateUrl(slug)}">Уточнить</a></div></article>`;
    }).join('');
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const rows = [['ТОС', 'slug', 'населённый пункт', 'приоритет', 'заполненность', 'статус', 'нужно уточнить', 'заметка', 'обновлено']];
    items.forEach((item) => {
      rows.push([
        item.name || '',
        item.slug || '',
        item.location || '',
        item.priority || '',
        item.score || '',
        statusMap[getStatus(item.slug)] || getStatus(item.slug),
        missingText(item),
        getNote(item.slug),
        state[item.slug]?.updatedAt || ''
      ]);
    });
    const csv = rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tos-collection-board-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function resetBoard() {
    if (!confirm('Сбросить все локальные статусы и заметки на этой доске?')) return;
    state = {};
    saveState();
    render();
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-board-status]');
    if (!select) return;
    setStatus(select.dataset.boardStatus, select.value);
  });

  document.addEventListener('input', (event) => {
    const textarea = event.target.closest('[data-board-note]');
    if (!textarea) return;
    setNote(textarea.datasetBoardNote, textarea.value);
  });

  document.querySelectorAll('[data-board-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.boardFilter || 'all';
      render();
    });
  });

  document.querySelector('[data-board-export]')?.addEventListener('click', exportCsv);
  document.querySelector('[data-board-reset]')?.addEventListener('click', resetBoard);

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
