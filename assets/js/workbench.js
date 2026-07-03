document.addEventListener('DOMContentLoaded', () => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const DRAFTS_KEY = 'tos-workbench-drafts-v1';

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

  function downloadCsv(rows, filename) {
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  function draftStatusLabel(value) {
    return {
      new: 'Новый контакт',
      contacted: 'Написали / ждём ответ',
      received: 'Сведения получены',
      ready: 'Готово к внесению',
      blocked: 'Нужна допроверка'
    }[value] || 'Черновик';
  }

  function readDrafts() {
    try {
      return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function writeDrafts(drafts) {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getDraft(slug) {
    return readDrafts()[String(slug || '')] || null;
  }

  function formatDraftDate(value) {
    if (!value) return 'ещё не сохранялось';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
  }

  function ensureTodayFocusSection() {
    if (document.querySelector('#workbench-today-focus')) return;
    const main = document.querySelector('#main');
    const hero = main?.querySelector('.hero');
    if (!main || !hero) return;

    hero.insertAdjacentHTML('afterend', `
      <section class="section tight" id="workbench-today-focus">
        <div class="container section-head">
          <div>
            <h2>Что делать сегодня</h2>
            <p>Короткий рабочий фокус из расширенного аудита сайта</p>
          </div>
          <div class="card-actions">
            <a class="btn" href="/site-health/">Аудит сайта</a>
            <a class="btn" href="/github-tasks/">GitHub-задачи</a>
            <a class="btn" href="/outreach-register/">Запросы</a>
          </div>
        </div>
        <div class="container grid" id="workbench-today-grid">
          <article class="card full"><div class="card-inner"><div class="empty">Загрузка фокуса...</div></div></article>
        </div>
      </section>`);
  }

  function renderTodayFocus(report) {
    ensureTodayFocusSection();
    const root = document.querySelector('#workbench-today-grid');
    if (!root || !report) return;

    const catalog = report.catalog || {};
    const pages = report.pages || {};
    const actions = (report.recommended_actions || []).slice(0, 5);
    const blocked = (report.blocked_actions || []).slice(0, 4);
    const priority = (report.priority_tos || []).slice(0, 4);
    const workPlan = (report.self_work_plan || []).filter((stage) => stage.owner === 'assistant').slice(0, 3);

    const actionHtml = actions.length
      ? `<ol>${actions.map((item) => `<li>${esc(item)}</li>`).join('')}</ol>`
      : '<p>В отчёте нет срочных действий.</p>';

    const priorityHtml = priority.length
      ? priority.map((item) => `<a class="tag ${item.verification === 'Требует проверки' ? 'warn' : ''}" href="/tos/${encodeURIComponent(item.slug || '')}/">${esc(item.name)} · ${esc(item.score ?? '—')}%</a>`).join(' ')
      : '<span class="tag ok">Критичных карточек нет</span>';

    const blockedHtml = blocked.length
      ? `<ul>${blocked.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '<p>Жёстких блокировок в отчёте нет.</p>';

    const workPlanHtml = workPlan.length
      ? workPlan.map((stage) => `<article class="card"><div class="card-inner"><span class="tag">самостоятельно</span><h3>${esc(stage.stage)}</h3><ul>${(stage.actions || []).slice(0, 3).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div></article>`).join('')
      : '<article class="card"><div class="card-inner"><h3>Самостоятельный план</h3><p>После обновления аудита здесь появятся безопасные действия ассистента.</p></div></article>';

    root.innerHTML = `
      <article class="card full highlight-card">
        <div class="card-inner">
          <div class="meta"><span class="tag">оценка: ${esc(report.health_score ?? '—')} / 100</span><span class="tag">публичных страниц: ${esc(pages.public ?? '—')}</span><span class="tag">ТОС: ${esc(catalog.total_tos ?? '—')}</span><span class="tag warn">verified: ${esc(catalog.verified_count ?? 0)}</span></div>
          <h3>Главный фокус: доверие к данным, а не рост количества страниц</h3>
          <p>Техническая база держится стабильно, поэтому ближайшая работа — подтверждать карточки, собирать открытые контакты, источники, фото и реальные материалы без публикации неподтверждённых фактов.</p>
          <div class="card-actions"><a class="btn primary" href="/verification-tasks/">Открыть задачи проверки</a><a class="btn" href="/data-requests/">Готовые запросы</a><a class="btn" href="/reply-review/">Разобрать ответ</a><a class="btn" href="/site-health/">Полный аудит</a></div>
        </div>
      </article>
      <article class="card"><div class="card-inner"><h3>Приоритетные действия</h3>${actionHtml}</div></article>
      <article class="card"><div class="card-inner"><h3>Карточки в фокусе</h3><p>${priorityHtml}</p><div class="card-actions"><a class="btn" href="/verification-tasks/">Все задачи</a><a class="btn" href="/data/verification_tasks.csv">CSV</a></div></div></article>
      <article class="card"><div class="card-inner"><h3>Нельзя делать без подтверждения</h3>${blockedHtml}</div></article>
      ${workPlanHtml}
    `;
  }

  function renderDraftPanel(slug) {
    const draft = getDraft(slug) || {};
    const status = draft.status || 'new';
    const note = draft.note || '';
    const selected = (value) => status === value ? ' selected' : '';

    return `<hr class="sep"/><div class="notice"><b style="color:var(--text)">Локальный черновик редактора</b><br>Сохраняется только в этом браузере и помогает не потерять сведения до внесения в JSON.</div><div class="toolbar"><select class="select" id="workbench-draft-status" aria-label="Статус черновика"><option value="new"${selected('new')}>Новый контакт</option><option value="contacted"${selected('contacted')}>Написали / ждём ответ</option><option value="received"${selected('received')}>Сведения получены</option><option value="ready"${selected('ready')}>Готово к внесению</option><option value="blocked"${selected('blocked')}>Нужна допроверка</option></select><button class="btn primary" id="workbench-save-draft" type="button">Сохранить</button><button class="btn" id="workbench-clear-draft" type="button">Очистить</button><button class="btn" id="workbench-export-drafts" type="button">CSV черновиков</button></div><textarea class="input" id="workbench-draft-note" rows="5" placeholder="Что получили: телефон, email, ссылку, источник подтверждения, фото, уточнение границ...">${esc(note)}</textarea><p class="tiny" id="workbench-draft-meta">Последнее сохранение: ${esc(formatDraftDate(draft.updated_at))}</p>`;
  }

  function wireDraftControls(slug) {
    const status = document.querySelector('#workbench-draft-status');
    const note = document.querySelector('#workbench-draft-note');
    const meta = document.querySelector('#workbench-draft-meta');
    const save = document.querySelector('#workbench-save-draft');
    const clear = document.querySelector('#workbench-clear-draft');
    const exportDrafts = document.querySelector('#workbench-export-drafts');
    if (!status || !note || !meta || !save || !clear || !exportDrafts) return;

    save.addEventListener('click', () => {
      const drafts = readDrafts();
      const updatedAt = new Date().toISOString();
      drafts[String(slug)] = {
        status: status.value,
        note: note.value.trim(),
        updated_at: updatedAt
      };
      const saved = writeDrafts(drafts);
      meta.textContent = saved
        ? `Последнее сохранение: ${formatDraftDate(updatedAt)}`
        : 'Не удалось сохранить черновик в браузере';
      applyPriorityFilters();
    });

    clear.addEventListener('click', () => {
      const drafts = readDrafts();
      delete drafts[String(slug)];
      writeDrafts(drafts);
      status.value = 'new';
      note.value = '';
      meta.textContent = 'Последнее сохранение: ещё не сохранялось';
      applyPriorityFilters();
    });

    exportDrafts.addEventListener('click', () => exportDraftsCsv(meta));
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
        <select class="select" id="workbench-draft-select" aria-label="Фильтр по черновикам">
          <option value="">Любой черновик</option>
          <option value="has">Есть черновик</option>
          <option value="new">Новый контакт</option>
          <option value="contacted">Написали / ждём ответ</option>
          <option value="received">Сведения получены</option>
          <option value="ready">Готово к внесению</option>
          <option value="blocked">Нужна допроверка</option>
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
    document.querySelector('#workbench-draft-select')?.addEventListener('change', applyPriorityFilters);
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
      missingType: document.querySelector('#workbench-missing-select')?.value || '',
      draftStatus: document.querySelector('#workbench-draft-select')?.value || ''
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

  function draftMatches(item, status) {
    if (!status) return true;
    const draft = getDraft(item.slug);
    if (status === 'has') return Boolean(draft);
    return Boolean(draft && draft.status === status);
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
      return priorityOk
        && missingMatches(item, filters.missingType)
        && draftMatches(item, filters.draftStatus)
        && matchesQuery(item, filters.query);
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
      const draft = getDraft(slug);
      const draftTag = draft ? `<span class="tag ok">Черновик: ${esc(draftStatusLabel(draft.status))}</span>` : '';
      const missing = (item.missing || []).slice(0, 5).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
      return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">${esc(item.location || '')}</span>${draftTag}</div><h3>ТОС «${esc(item.name)}»</h3><p>${missing || 'Нужна проверка актуальности сведений.'}</p><div class="card-actions"><button class="btn" type="button" data-preview="${esc(slug)}">Предпросмотр</button><a class="btn" href="/tos/${urlSlug}/">Карточка</a><a class="btn" href="/data-requests/">Сообщение</a><a class="btn primary" href="${updateUrl(slug)}">Уточнить</a></div></article>`;
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

    body.innerHTML = `<div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">slug: ${esc(slug)}</span></div><h2>Предпросмотр: ТОС «${esc(tos.name || item.name || slug)}»</h2><div class="kpi"><div class="tile"><b>${valueOrEmpty(tos.type)}</b><span>тип ТОС</span></div><div class="tile"><b>${valueOrEmpty(tos.population)}</b><span>жителей</span></div><div class="tile"><b>${valueOrEmpty(tos.founded)}</b><span>год создания</span></div></div><hr class="sep"/><div class="kpi"><div class="tile"><b>Территория</b><span>Место: ${valueOrEmpty(tos.location || item.location)}<br>Границы: ${valueOrEmpty(tos.boundaries)}</span></div><div class="tile"><b>Контакты</b><span>Председатель: ${valueOrEmpty(tos.chairperson)}<br>Телефон: ${listOrEmpty(tos.phones)}<br>Email: ${listOrEmpty(tos.emails)}</span></div><div class="tile"><b>Публичность</b><span>Соцсети: ${listOrEmpty(tos.social_links)}<br>Логотип: ${tos.logo ? esc(tos.logo) : 'нужно добавить'}<br>Обновлено: ${valueOrEmpty(tos.updated_at)}</span></div></div><hr class="sep"/><p>${esc(description)}</p><div class="meta">${missing || '<span class="tag ok">Критичных пробелов в аудите не указано</span>'}</div>${renderDraftPanel(slug)}<div class="card-actions"><a class="btn" href="/tos/${encodeURIComponent(slug)}/">Открыть карточку</a><a class="btn" href="/data-requests/">Открыть сообщение</a><a class="btn primary" href="${updateUrl(slug)}">Уточнить данные</a></div>`;
    preview.hidden = false;
    wireDraftControls(slug);
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportDraftsCsv(meta) {
    const drafts = readDrafts();
    const entries = Object.entries(drafts).filter(([slug, draft]) => slug && draft);
    if (!entries.length) {
      if (meta) meta.textContent = 'Сохранённых черновиков пока нет';
      return;
    }

    const rows = [
      ['slug', 'name', 'status', 'note', 'updated_at', 'card_url', 'update_url'],
      ...entries.map(([slug, draft]) => {
        const tos = tosBySlug.get(String(slug)) || {};
        return [
          slug,
          tos.name || '',
          draft.status || '',
          draft.note || '',
          draft.updated_at || '',
          `https://tosborisoglebsk.ru/tos/${slug}/`,
          `https://tosborisoglebsk.ru${updateUrl(slug)}`
        ];
      })
    ];

    downloadCsv(rows, `tos-workbench-drafts-${new Date().toISOString().slice(0, 10)}.csv`);
    if (meta) meta.textContent = `Выгружено черновиков: ${entries.length}`;
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

    downloadCsv(rows, `tos-priority-selection-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  ensureTodayFocusSection();
  ensurePriorityControls();

  Promise.all([
    getJson('/data/site_audit.json').catch(() => null),
    getJson('/data/tos_content_audit.json').catch(() => null),
    getJson('/data/toses.json').catch(() => []),
    getJson('/data/site_health.json').catch(() => null)
  ]).then(([siteAudit, contentAudit, toses, siteHealth]) => {
    buildTosLookup(toses);
    if (siteHealth) renderTodayFocus(siteHealth);
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
