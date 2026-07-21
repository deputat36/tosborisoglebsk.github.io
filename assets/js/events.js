const eventEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const eventsCore = window.EventsCore;

const eventPublished = (item) => item && item.status !== 'draft';

const eventFmtDate = (value) => {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const eventFmtTime = (value) => value ? value.slice(0, 5) : 'время уточняется';

async function loadEventsData() {
  const [events, toses] = await Promise.all([
    fetch('/data/events.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { events: events.filter(eventPublished), toses };
}

function eventTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function eventSourceTag(item) {
  const kind = eventsCore.sourceKind(item);
  return `<span class="tag ${kind === 'unconfirmed' ? 'warn' : ''}">${eventEsc(eventsCore.sourceLabel(kind))}</span>`;
}

function eventCard(item, toses) {
  const tosName = eventTosName(item.tos_slug, toses);
  const dateState = eventsCore.dateState(item);
  const sourceKind = eventsCore.sourceKind(item);
  return `<article class="list-item event-card" data-event-id="${eventEsc(item.id || '')}" data-event-date-state="${eventEsc(dateState.key)}" data-event-source-kind="${eventEsc(sourceKind)}" data-event-tos="${eventEsc(item.tos_slug || '')}">
    <div class="meta">
      <span class="tag ${dateState.className}">${eventEsc(dateState.label)}</span>
      ${eventSourceTag(item)}
      <span class="tag">${eventEsc(item.type || 'Событие')}</span>
      <span class="tag">${eventEsc(eventFmtDate(item.date))}</span>
      <span class="tag">${eventEsc(eventFmtTime(item.time))}</span>
      ${tosName ? `<span class="tag">${eventEsc(tosName)}</span>` : ''}
    </div>
    <h3>${eventEsc(item.title || 'Событие без названия')}</h3>
    <p>${eventEsc(item.description || '')}</p>
    ${item.place ? `<p class="tiny"><b>Место:</b> ${eventEsc(item.place)}</p>` : ''}
    ${item.source ? `<p class="tiny"><b>Источник:</b> ${eventEsc(item.source)}</p>` : ''}
    <div class="notice"><b style="color:var(--text)">Проверка даты</b><br>${eventEsc(eventsCore.sourceNotice(sourceKind))}</div>
    <div class="card-actions">
      ${item.tos_slug ? `<a class="btn" href="/tos/${eventEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${eventEsc(item.source_url)}">Проверить связанный источник</a>` : ''}
      <a class="btn" href="/update-tos/?type=event#message-builder">Уточнить или добавить событие</a>
    </div>
  </article>`;
}

function renderEventsSummary(events) {
  const root = document.querySelector('#events-summary');
  if (!root) return;
  const summary = eventsCore.summary(events);
  root.innerHTML = `<div class="summary-grid" data-calendar-summary>
    <div class="summary-tile"><b>${summary.total}</b><span>всего записей</span></div>
    <div class="summary-tile"><b>${summary.upcoming}</b><span>сегодня и впереди</span></div>
    <div class="summary-tile"><b>${summary.past}</b><span>в архиве</span></div>
    <div class="summary-tile"><b>${summary.external}</b><span>с внешним источником</span></div>
    <div class="summary-tile"><b>${summary.editorial}</b><span>рабочих дат редакции</span></div>
  </div>`;
}

async function renderEvents() {
  const root = document.querySelector('#events-list');
  if (!root) return;
  if (!eventsCore) {
    root.innerHTML = '<div class="empty">Календарь не загрузился: отсутствует модуль фильтрации.</div>';
    return;
  }

  const search = document.querySelector('#event-search');
  const type = document.querySelector('#event-type-filter');
  const tos = document.querySelector('#event-tos-filter');
  const period = document.querySelector('#event-period-filter');
  const source = document.querySelector('#event-source-filter');
  const reset = document.querySelector('#event-reset-filters');
  const filterStatus = document.querySelector('#event-filter-status');

  try {
    const { events, toses } = await loadEventsData();
    const types = [...new Set(events.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(events.map((item) => item.tos_slug).filter(Boolean))];

    if (type) type.innerHTML = '<option value="">Все типы</option>' + types.map((value) => `<option value="${eventEsc(value)}">${eventEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${eventEsc(slug)}">${eventEsc(eventTosName(slug, toses))}</option>`).join('');

    const initial = eventsCore.stateFromSearch(location.search);
    if (search) search.value = initial.q;
    if (type && [...type.options].some((option) => option.value === initial.type)) type.value = initial.type;
    if (tos && [...tos.options].some((option) => option.value === initial.tos)) tos.value = initial.tos;
    if (period) period.value = initial.period;
    if (source) source.value = initial.source;

    renderEventsSummary(events);

    function currentState() {
      return {
        q: search?.value || '',
        type: type?.value || '',
        tos: tos?.value || '',
        period: period?.value || 'upcoming',
        source: source?.value || ''
      };
    }

    function syncUrl(state) {
      history.replaceState(null, '', `${location.pathname}${eventsCore.stateToSearch(state)}${location.hash || ''}`);
    }

    function apply() {
      const state = currentState();
      const filtered = eventsCore.filterAndSort(events, state, {
        tosName: (slug) => eventTosName(slug, toses)
      });
      root.innerHTML = filtered.length
        ? filtered.map((item) => eventCard(item, toses)).join('')
        : '<div class="empty">По выбранным условиям событий нет. Откройте архив, сбросьте фильтры или передайте новую дату.</div>';
      syncUrl(state);
      if (filterStatus) {
        const periodLabel = period?.selectedOptions?.[0]?.textContent || 'Все даты';
        filterStatus.textContent = `Показано ${filtered.length} из ${events.length}. Режим: ${periodLabel}. Активных дополнительных условий: ${eventsCore.activeFilterCount(state)}.`;
      }
    }

    [search, type, tos, period, source].forEach((element) => element?.addEventListener('input', apply));
    reset?.addEventListener('click', () => {
      if (search) search.value = '';
      if (type) type.value = '';
      if (tos) tos.value = '';
      if (period) period.value = 'upcoming';
      if (source) source.value = '';
      apply();
      search?.focus();
    });
    search?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && search.value) {
        search.value = '';
        apply();
      }
    });
    apply();
  } catch {
    root.innerHTML = '<div class="empty">Календарь не загрузился. Проверьте файл data/events.json</div>';
  }
}

renderEvents();
