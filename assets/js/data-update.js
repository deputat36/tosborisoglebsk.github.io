(() => {
  const root = document.querySelector('#update-list');
  const statsRoot = document.querySelector('#update-stats');
  const searchInput = document.querySelector('#update-search');
  const statusSelect = document.querySelector('#update-status');
  const typeSelect = document.querySelector('#update-type');
  if (!root || !statsRoot) return;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const updateUrl = (item) => `/update-tos/?tos=${encodeURIComponent(item.slug || '')}&type=card#message-builder`;
  const tosUrl = (item) => `/tos/${encodeURIComponent(item.slug || '')}/`;

  const checks = [
    ['chairperson', 'председатель', (t) => Boolean(String(t.chairperson || '').trim())],
    ['phones', 'телефон', (t) => Array.isArray(t.phones) && t.phones.length > 0],
    ['emails', 'email', (t) => Array.isArray(t.emails) && t.emails.length > 0],
    ['chairperson_links', 'личная страница', (t) => Array.isArray(t.chairperson_links) && t.chairperson_links.length > 0],
    ['social_links', 'сообщество или соцсеть', (t) => Array.isArray(t.social_links) && t.social_links.length > 0],
    ['boundaries', 'границы', (t) => Boolean(String(t.boundaries || '').trim())],
    ['founded', 'год создания', (t) => Boolean(String(t.founded || '').trim())],
    ['population', 'численность жителей', (t) => Boolean(String(t.population || '').trim())],
    ['description', 'описание', (t) => {
      const value = String(t.description || '').trim();
      return Boolean(value) && value !== 'Описание пока уточняется.';
    }],
    ['logo', 'логотип', (t) => Boolean(String(t.logo || '').trim())],
    ['updated_at', 'дата обновления', (t) => Boolean(String(t.updated_at || '').trim())]
  ];

  function evaluate(tos) {
    const missing = checks.filter(([, , test]) => !test(tos)).map(([, label]) => label);
    const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
    const status = score >= 80 ? 'complete' : score >= 55 ? 'attention' : 'critical';
    const statusLabel = status === 'complete' ? 'Заполнена хорошо' : status === 'attention' ? 'Требует уточнений' : 'Нужно обновить';
    return { ...tos, score, status, statusLabel, missing };
  }

  function renderStats(items) {
    const complete = items.filter((item) => item.status === 'complete').length;
    const attention = items.filter((item) => item.status === 'attention').length;
    const critical = items.filter((item) => item.status === 'critical').length;
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0;
    statsRoot.innerHTML = [
      ['Всего ТОС', items.length],
      ['Средняя заполненность', `${avg}%`],
      ['Заполнены хорошо', complete],
      ['Требуют уточнений', attention],
      ['Нужно обновить', critical]
    ].map(([label, value]) => `<div class="tile"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');
  }

  function renderCard(item) {
    const missing = item.missing.length
      ? item.missing.map((label) => `<span class="tag warn">${escapeHtml(label)}</span>`).join('')
      : '<span class="tag">Все основные сведения заполнены</span>';
    const progressLabel = `${item.score}% — ${item.statusLabel}`;
    return `<article class="list-item" data-status="${escapeHtml(item.status)}" data-type="${escapeHtml(item.type || '')}">
      <div class="meta"><span class="tag">${escapeHtml(item.type || 'ТОС')}</span><span class="tag ${item.status !== 'complete' ? 'warn' : ''}">${escapeHtml(progressLabel)}</span>${item.updated_at ? `<span class="tag">Обновлено: ${escapeHtml(item.updated_at)}</span>` : ''}</div>
      <h3>ТОС «${escapeHtml(item.name || '')}»</h3>
      <p><b>Территория:</b> ${escapeHtml(item.location || 'уточняется')}<br><b>Председатель:</b> ${escapeHtml(item.chairperson || 'уточняется')}</p>
      <div class="notice"><b style="color:var(--text)">Нужно дополнить</b><br>${missing}</div>
      <div class="card-actions"><a class="btn" href="${tosUrl(item)}">Открыть карточку</a><a class="btn primary" href="${updateUrl(item)}">Исправить данные</a></div>
    </article>`;
  }

  function initFilters(items) {
    const apply = () => {
      const query = String(searchInput?.value || '').trim().toLowerCase();
      const status = statusSelect?.value || '';
      const type = typeSelect?.value || '';
      const filtered = items.filter((item) => {
        const haystack = [item.name, item.location, item.chairperson, item.boundaries, item.description].join(' ').toLowerCase();
        return (!query || haystack.includes(query)) && (!status || item.status === status) && (!type || item.type === type);
      });
      root.innerHTML = filtered.length ? filtered.map(renderCard).join('') : '<div class="empty">По выбранным условиям карточки не найдены.</div>';
    };
    [searchInput, statusSelect, typeSelect].forEach((element) => element?.addEventListener('input', apply));
    apply();
  }

  fetch('/data/toses.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('Не удалось загрузить data/toses.json');
      return response.json();
    })
    .then((data) => {
      const items = (Array.isArray(data) ? data : [])
        .filter((item) => item && item.status !== 'draft')
        .map(evaluate)
        .sort((a, b) => a.score - b.score || String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
      renderStats(items);
      initFilters(items);
    })
    .catch((error) => {
      console.error(error);
      statsRoot.innerHTML = '<div class="empty">Статистика не загрузилась.</div>';
      root.innerHTML = '<div class="empty">Не удалось прочитать data/toses.json.</div>';
    });
})();