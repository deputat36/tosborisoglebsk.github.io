const needsCore = window.CollectionBrowserCore;

const needsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const needsFmtDate = (value) => {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const needsPublished = (item) => item.status !== 'draft';
const isClosedNeed = (item) => ['closed', 'done', 'archived'].includes(String(item.status || '').toLowerCase());
const isPartnerNeed = (item) => [item.need_type, item.description, item.how_to_help, item.help].join(' ').toLowerCase().includes('партн');
const needsFields = ['q', 'type', 'tos', 'priority', 'status', 'origin'];

function needsOrigin(item) {
  if (['verified', 'editorial', 'starter', 'request'].includes(item.content_origin)) return item.content_origin;
  if (String(item.id || '').startsWith('update-data-')) return 'request';
  return 'editorial';
}

function needsOriginTag(item) {
  const origin = needsOrigin(item);
  const labels = {
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовый материал',
    request: 'Запрос данных'
  };
  const className = origin === 'verified' ? 'ok' : origin === 'request' ? 'warn' : '';
  return `<span class="tag ${className}">${needsEsc(labels[origin])}</span>`;
}

async function loadNeedsData() {
  const [needs, toses] = await Promise.all([
    fetch('/data/needs.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { needs: needs.filter(needsPublished), toses };
}

function needsTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function priorityClass(priority) {
  return String(priority || '').toLowerCase().includes('выс') ? 'warn' : '';
}

function statusLabel(status) {
  if (status === 'closed' || status === 'done') return 'Закрыто';
  if (status === 'archived') return 'Архив';
  if (status === 'in_progress') return 'В работе';
  if (status === 'published') return 'В каталоге';
  return status ? `Технический статус: ${status}` : 'Технический статус уточняется';
}

function statusClass(status) {
  if (status === 'closed' || status === 'done') return 'ok';
  if (status === 'in_progress') return 'warn';
  return '';
}

function renderNeedsSummary(items, total) {
  const root = document.querySelector('#needs-summary');
  if (!root) return;
  const counts = needsCore.countOrigins(items, needsOrigin);
  const open = items.filter((item) => !isClosedNeed(item)).length;
  const closed = items.filter(isClosedNeed).length;
  const partner = items.filter(isPartnerNeed).length;
  root.innerHTML = `<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>показано из ${total}</span></div><div class="summary-tile"><b>${open}</b><span>незакрытые записи</span></div><div class="summary-tile"><b>${closed}</b><span>закрытые и архивные</span></div><div class="summary-tile"><b>${counts.editorial}</b><span>редакционные материалы</span></div><div class="summary-tile"><b>${counts.request}</b><span>запросы данных</span></div><div class="summary-tile"><b>${partner}</b><span>для партнёров</span></div></div>`;
}

function needCard(item, toses) {
  const tosName = needsTosName(item.tos_slug, toses);
  const origin = needsOrigin(item);
  const defaultHelp = origin === 'request'
    ? 'Передайте подтверждённые сведения, официальный источник, актуальные контакты или фотографии с разрешением на публикацию. Материальная помощь для такой записи не требуется.'
    : 'Свяжитесь с ответственным и уточните, чем именно можете помочь: материалами, временем, транспортом, волонтёрами, фото или информационной поддержкой.';
  const helpText = item.how_to_help || item.help || defaultHelp;
  const resultText = item.result || item.closed_result || '';
  return `<article class="list-item need-card" data-content-origin="${needsEsc(origin)}">
    <div class="meta">
      ${needsOriginTag(item)}
      <span class="tag ${statusClass(item.status)}">${needsEsc(statusLabel(item.status))}</span>
      <span class="tag">${needsEsc(item.need_type || 'Потребность')}</span>
      <span class="tag ${priorityClass(item.priority)}">${needsEsc(item.priority || 'Приоритет уточняется')}</span>
      <span class="tag">${needsEsc(needsFmtDate(item.date))}</span>
      ${tosName ? `<span class="tag">${needsEsc(tosName)}</span>` : ''}
      ${isPartnerNeed(item) ? '<span class="tag ok">подходит партнёрам</span>' : ''}
    </div>
    <h3>${needsEsc(item.title || 'Потребность без названия')}</h3>
    <p>${needsEsc(item.description || '')}</p>
    <div class="notice"><b style="color:var(--text)">Как помочь</b><br>${needsEsc(helpText)}</div>
    ${resultText ? `<p class="tiny"><b>Результат:</b> ${needsEsc(resultText)}</p>` : ''}
    <p class="tiny"><b>Контакт:</b> ${needsEsc(item.contact || 'Уточняется')}</p>
    <div class="card-actions">
      <a class="btn primary" href="/needs/${needsEsc(item.id)}/">Подробнее</a>
      ${item.tos_slug ? `<a class="btn" href="/tos/${needsEsc(item.tos_slug)}/">Открыть ТОС</a>` : ''}
      <a class="btn" href="/contacts/">Предложить помощь</a>
      <a class="btn" href="/update-tos/?type=need#message-builder">Уточнить потребность</a>
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${needsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

async function renderNeeds() {
  const root = document.querySelector('#needs-list');
  if (!root || !needsCore) return;

  const controls = {
    q: document.querySelector('#needs-search'),
    type: document.querySelector('#needs-type-filter'),
    tos: document.querySelector('#needs-tos-filter'),
    priority: document.querySelector('#needs-priority-filter'),
    status: document.querySelector('#needs-status-filter'),
    origin: document.querySelector('#needs-origin-filter')
  };
  const reset = document.querySelector('#needs-reset-filters');
  const statusText = document.querySelector('#needs-filter-status');

  try {
    const { needs, toses } = await loadNeedsData();
    const types = [...new Set(needs.map((item) => item.need_type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const priorities = [...new Set(needs.map((item) => item.priority).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(needs.map((item) => item.tos_slug).filter(Boolean))];

    if (controls.type) controls.type.innerHTML = '<option value="">Все типы помощи</option>' + types.map((value) => `<option>${needsEsc(value)}</option>`).join('');
    if (controls.priority) controls.priority.innerHTML = '<option value="">Любой приоритет</option>' + priorities.map((value) => `<option>${needsEsc(value)}</option>`).join('');
    if (controls.tos) controls.tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${needsEsc(slug)}">${needsEsc(needsTosName(slug, toses))}</option>`).join('');

    needsCore.applyControls(needsCore.parseState(window.location.search, needsFields), controls);

    function apply(sync = true) {
      const state = needsCore.readControls(controls);
      const query = needsCore.normalizeText(state.q);
      const filtered = needs
        .filter((item) => !state.type || item.need_type === state.type)
        .filter((item) => !state.priority || item.priority === state.priority)
        .filter((item) => !state.tos || item.tos_slug === state.tos)
        .filter((item) => !state.origin || needsOrigin(item) === state.origin)
        .filter((item) => state.status !== 'active' || !isClosedNeed(item))
        .filter((item) => state.status !== 'closed' || isClosedNeed(item))
        .filter((item) => state.status !== 'partner' || isPartnerNeed(item))
        .filter((item) => {
          const tosName = needsTosName(item.tos_slug, toses);
          const hay = needsCore.normalizeText([item.title, item.description, item.need_type, item.priority, item.contact, item.source, item.how_to_help, item.result, tosName, needsOrigin(item)].join(' '));
          return !query || hay.includes(query);
        })
        .sort((a, b) => {
          const statusA = isClosedNeed(a) ? 1 : 0;
          const statusB = isClosedNeed(b) ? 1 : 0;
          if (statusA !== statusB) return statusA - statusB;
          return String(b.date || '').localeCompare(String(a.date || ''));
        });

      root.innerHTML = filtered.length ? filtered.map((item) => needCard(item, toses)).join('') : '<div class="empty">По выбранным фильтрам потребности и запросы не найдены. Сбросьте фильтры или измените запрос.</div>';
      renderNeedsSummary(filtered, needs.length);
      needsCore.setStatus(statusText, filtered.length, needs.length, needsCore.activeFilterCount(state));
      if (sync) needsCore.syncUrl(state, needsFields);
    }

    needsCore.bindControls(controls, () => apply(true));
    reset?.addEventListener('click', () => {
      needsCore.resetControls(controls);
      apply(true);
      controls.q?.focus();
    });
    controls.q?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && controls.q.value) {
        controls.q.value = '';
        apply(true);
      }
    });
    apply(true);
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/needs.json</div>';
    if (statusText) statusText.textContent = 'Ошибка загрузки потребностей.';
  }
}

renderNeeds();
