document.addEventListener('DOMContentLoaded', () => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  let priorityItems = [];
  let filteredPriorityItems = [];
  let tosBySlug = new Map();

  async function getJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
    return response.json();
  }

  function updateUrl(slug) {
    return `/update-tos/?tos=${encodeURIComponent(slug || '')}&type=card#message-builder`;
  }

  function normalize(value) {
    return String(value ?? '').toLowerCase().trim();
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function buildTosLookup(toses) {
    tosBySlug = new Map((Array.isArray(toses) ? toses : [])
      .filter((tos) => tos && tos.slug)
      .map((tos) => [String(tos.slug), tos]));
  }

  function valueOrEmpty(value) {
    return value ? esc(value) : 'уточняется';
  }

  function listOrEmpty(values) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    return list.length ? list.map((value) => esc(value)).join(', ') : 'уточняется';
  }

  function ensurePriorityControls() {
    const root = document.querySelector('#workbench-priority-list');
    if (!root || document.querySelector('#workbench-priority-toolbar')) return;

    root.insertAdjacentHTML('beforebegin', `
      <div class="container toolbar" id="workbench-priority-toolbar">
        <input class="input" id="workbench-priority-search" type="search" placeholder="Поиск по ТОС, месту или недостающему полю"/>
        <select class="select" id="workbench-priority-select" aria-label="Фильтр по приоритету">
          <option value="">Любой приоритет</option>
          <option value="Высокий">Высокий приоритет</option>
          <option value="Средний">Средний приоритет</option>
          <option value="Низкий">Низкий приоритет</option>
        </select>
        <select class="select" id="workbench-missing-select" aria-label="Фильтр по недостающим сведениям">
          <option value="">Любой пробел</option>
          <option value="phone">Нет телефона</option>
          <option value="email">Нет email</option>
          <option value="social">Нет соцсетей или ссылки</option>
          <option value="logo">Нет логотипа или фото</option>
          <option value="source">Нет источника проверки</option>
          <option value="boundaries">Нужно уточнить границы</option>
          <option value="description">Нужно описание</option>
        </select>
        <button class="btn" id="workbench-export-current" type="button">CSV выборки</button>
      </div>`);

    root.insertAdjacentHTML('beforebegin', `
      <div class="container grid" id="workbench-card-preview" hidden>
        <article class="card full">
          <div class="card-inner" id="workbench-card-preview-body"></div>
        </article>
      </div>`);

    document.querySelector('#workbench-priority-search')?.addEventListener('input', applyPriorityFilters);
    document.querySelector('#workbench-priority-select')?.addEventListener('change', applyPriorityFilters);
    document.querySelector('#workbench-missing-select')?.addEventListener('change', applyPriorityFilters);
    document.querySelector('#workbench-export-current')?.addEventListener('click', exportPriorityCsv);

    document.querySelectorAll('a[href="/update-tos/"]').forEach((link) => {
      link.setAttribute('href', '/update-tos/?type=card#message-builder');
    });
  }

  function renderAuditSummary(audit) {
    const root = document.querySelector('#workbench-audit-summary');
    if (!root) return;
    const summary = audit.summary || audit;
    const values = [
      ['Всего ТОС', summary.total_tos || 0],
      ['Средняя заполненность', `${summary.average_score || 0}%`],
      ['Высокий приоритет', summary.high_priority || 0],
      ['Без телефона', summary.without_phone || 0],
      ['Без соцсетей', summary.without_social || 0],
      ['Требует проверки', summary.needs_review_count || 0]
    ];
    root.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function renderNextActions(audit) {
    const root = document.querySelector('#workbench-next-actions');
    if (!root) return;
    const actions = audit.next_actions || [];
    if (!actions.length) {
      root.innerHTML = '<div class="empty">Следующие действия не сформированы. Дождитесь обновления аудита.</div>';
      return;
    }
    root.innerHTML = actions.slice(0, 8).map((action) => `<li>${esc(action)}</li>`).join('');
  }

  function itemPriorityRank(item) {
    if (item.priority === 'Высокий') return 0;
    if (item.priority === 'Средний') return 1;
    if (item.priority === 'Низкий') return 2;
    return 3;
  }

  function readPriorityFilters() {
    return {
      query: normalize(document.querySelector('#workbench-priority-search')?.value || ''),
      priority: document.querySelector('#workbench-priority-select')?.value || '',
      missingType: document.querySelector('#workbench-missing-select')?.value || ''
    };
  }

  function missingMatches(item, type) {
    if (!type) return true;
    const text = normalize((item.missing || []).join(' '));
    const aliases = {
      phone: ['телефон', 'phone'],
      email: ['email', 'почт'],
      social: ['соц', 'ссылк', 'групп', 'чат'],
      logo: ['логотип', 'фото'],
      source: ['источник', 'провер'],
      boundaries: ['границ'],
      description: ['описан']
    };
    return (aliases[type] || [type]).some((part) => text.includes(part));
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    const haystack = normalize([
      item.name,
      item.slug,
      item.location,
      item.priority,
      item.score,
      ...(item.missing || [])
    ].join(' '));
    return haystack.includes(query);
  }

  function buildPriorityItems(contentAudit) {
    return (contentAudit.items || [])
      .filter((item) => item.priority === 'Высокий' || (item.missing || []).length)
      .sort((a, b) => {
        return itemPriorityRank(a) - itemPriorityRank(b)
          || (b.missing || []).length - (a.missing || []).length
          || String(a.name).localeCompare(String(b.name), 'ru');
      });
  }

  function applyPriorityFilters() {
    const filters = readPriorityFilters();
    filteredPriorityItems = priorityItems.filter((item) => {
      const priorityOk = !filters.priority || item.priority === filters.priority;
      return priorityOk && missingMatches(item, filters.missingType) && matchesQuery(item, filters.query);
    });
    renderPriorityList(filteredPriorityItems);
  }

  function renderPriorityList(items) {
    const root = document.querySelector('#workbench-priority-list');
    if (!root) return;

    if (!items.length) {
      root.innerHTML = '<div class="empty">По выбранным фильтрам карточек нет.</div>';
      return;
    }

    const shown = items.slice(0, 12);
    const counter = `<div class="tiny">Показано ${shown.length} из ${items.length}. CSV выгружает всю текущую выборку.</div>`;
    const cards = shown.map((item) => {
      const slug = String(item.slug || '');
      const urlSlug = encodeURIComponent(slug);
      const missing = (item.missing || []).slice(0, 5).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
      return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">${esc(item.location || '')}</span></div><h3>ТОС «${esc(item.name)}»</h3><p>${missing || 'Нужна проверка актуальности сведений.'}</p><div class="card-actions"><button class="btn" type="button" data-preview="${esc(slug)}">Предпросмотр</button><a class="btn" href="/tos/${urlSlug}/">Карточка</a><a class="btn" href="/data-requests/">Сообщение</a><a class="btn primary" href="${updateUrl(slug)}">Уточнить</a></div></article>`;
    }).join('');

    root.innerHTML = `${counter}${cards}`;
    root.querySelectorAll('[data-preview]').forEach((button) => {
      button.addEventListener('click', () => renderCardPreview(button.getAttribute('data-preview')));
    });
  }

  function renderPriorityItems(contentAudit) {
    ensurePriorityControls();
    priorityItems = buildPriorityItems(contentAudit);
    filteredPriorityItems = priorityItems;
    applyPriorityFilters();
  }

  function renderCardPreview(slug) {
    const preview = document.querySelector('#workbench-card-preview');
    const body = document.querySelector('#workbench-card-preview-body');
    if (!preview || !body || !slug) return;

    const item = priorityItems.find((entry) => String(entry.slug || '') === String(slug)) || {};
    const tos = tosBySlug.get(String(slug)) || {};
    const missing = (item.missing || []).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
    const description = tos.description && tos.description !== 'Описание пока уточняется.'
      ? tos.description
      : 'Описание карточки нужно уточнить.';

    body.innerHTML = `<div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">slug: ${esc(slug)}</span></div><h2>Предпросмотр: ТОС «${esc(tos.name || item.name || slug)}»</h2><div class="kpi"><div class="tile"><b>${valueOrEmpty(tos.type)}</b><span>тип ТОС</span></div><div class="tile"><b>${valueOrEmpty(tos.population)}</b><span>жителей</span></div><div class="tile"><b>${valueOrEmpty(tos.founded)}</b><span>год создания</span></div></div><hr class="sep"/><div class="kpi"><div class="tile"><b>Территория</b><span>Место: ${valueOrEmpty(tos.location || item.location)}<br>Границы: ${valueOrEmpty(tos.boundaries)}</span></div><div class="tile"><b>Контакты</b><span>Председатель: ${valueOrEmpty(tos.chairperson)}<br>Телефон: ${listOrEmpty(tos.phones)}<br>Email: ${listOrEmpty(tos.emails)}</span></div><div class="tile"><b>Публичность</b><span>Соцсети: ${listOrEmpty(tos.social_links)}<br>Логотип: ${tos.logo ? esc(tos.logo) : 'нужно добавить'}<br>Обновлено: ${valueOrEmpty(tos.updated_at)}</span></div></div><hr class="sep"/><p>${esc(description)}</p><div class="meta">${missing || '<span class="tag ok">Критичных пробелов в аудите не указано</span>'}</div><div class="card-actions"><a class="btn" href="/tos/${encodeURIComponent(slug)}/">Открыть карточку</a><a class="btn" href="/data-requests/">Открыть сообщение</a><a class="btn primary" href="${updateUrl(slug)}">Уточнить данные</a></div>`;
    preview.hidden = false;
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportPriorityCsv() {
    if (!filteredPriorityItems.length) return;

    const rows = [
      ['priority', 'score', 'slug', 'name', 'location', 'missing', 'card_url', 'update_url'],
      ...filteredPriorityItems.map((item) => {
        const slug = String(item.slug || '');
        return [
          item.priority || '',
          item.score || '',
          slug,
          item.name || '',
          item.location || '',
          (item.missing || []).join('; '),
          `https://tosborisoglebsk.ru/tos/${slug}/`,
          `https://tosborisoglebsk.ru${updateUrl(slug)}`
        ];
      })
    ];

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tos-priority-selection-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  ensurePriorityControls();

  Promise.all([
    getJson('/data/site_audit.json').catch(() => null),
    getJson('/data/tos_content_audit.json').catch(() => null),
    getJson('/data/toses.json').catch(() => [])
  ]).then(([siteAudit, contentAudit, toses]) => {
    buildTosLookup(toses);
    if (siteAudit) {
      renderAuditSummary(siteAudit);
      renderNextActions(siteAudit);
    }
    if (contentAudit) renderPriorityItems(contentAudit);
  }).catch(() => {
    const summary = document.querySelector('#workbench-audit-summary');
    if (summary) summary.innerHTML = '<article class="stat"><b>—</b><span>аудит не загрузился</span></article>';
  });
});