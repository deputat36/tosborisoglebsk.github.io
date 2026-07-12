const eventEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const eventPublished = (item) => item && item.status !== 'draft';

const eventDateValue = (item) => `${item.date || ''}T${item.time || '00:00'}`;

const eventFmtDate = (value) => {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const eventFmtTime = (value) => value ? value.slice(0, 5) : 'время уточняется';

function eventDateState(item) {
  if (!item.date) return { label: 'дата уточняется', className: '' };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const date = new Date(`${item.date}T00:00:00`).getTime();
  if (Number.isNaN(date)) return { label: 'дата уточняется', className: '' };
  if (date < today) return { label: 'дата прошла', className: '' };
  if (date === today) return { label: 'дата сегодня', className: 'warn' };
  return { label: 'дата впереди', className: '' };
}

function eventIsPast(item) {
  return eventDateState(item).label === 'дата прошла';
}

function eventSourceKind(item) {
  const source = String(item.source || '').toLowerCase();
  if (source.includes('редакция портала')) return 'editorial';
  if (item.source_url) return 'external';
  return 'unconfirmed';
}

function eventSourceTag(item) {
  const kind = eventSourceKind(item);
  const labels = {
    external: 'есть внешний источник',
    editorial: 'рабочая дата редакции',
    unconfirmed: 'источник нужно уточнить'
  };
  return `<span class="tag ${kind === 'unconfirmed' ? 'warn' : ''}">${eventEsc(labels[kind])}</span>`;
}

function eventTrustNotice(item) {
  const kind = eventSourceKind(item);
  if (kind === 'external') {
    return 'Перед участием проверьте дату, условия, место и возможные изменения на странице источника.';
  }
  if (kind === 'editorial') {
    return 'Это рабочая контрольная точка редакции, а не официальный дедлайн или подтверждённый анонс события.';
  }
  return 'Источник и актуальность даты нужно уточнить до публикации анонса, поездки или подготовки заявки.';
}

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

function eventCard(item, toses) {
  const tosName = eventTosName(item.tos_slug, toses);
  const dateState = eventDateState(item);
  return `<article class="list-item event-card">
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
    <div class="notice"><b style="color:var(--text)">Проверка даты</b><br>${eventEsc(eventTrustNotice(item))}</div>
    <div class="card-actions">
      ${item.tos_slug ? `<a class="btn" href="/tos/${eventEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${eventEsc(item.source_url)}">Проверить источник</a>` : ''}
      <a class="btn" href="/update-tos/?type=event#message-builder">Уточнить или добавить событие</a>
    </div>
  </article>`;
}

async function renderEvents() {
  const root = document.querySelector('#events-list');
  if (!root) return;
  const search = document.querySelector('#event-search');
  const type = document.querySelector('#event-type-filter');
  const tos = document.querySelector('#event-tos-filter');

  try {
    const { events, toses } = await loadEventsData();
    const types = [...new Set(events.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(events.map((item) => item.tos_slug).filter(Boolean))];

    if (type) type.innerHTML = '<option value="">Все типы</option>' + types.map((value) => `<option>${eventEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${eventEsc(slug)}">${eventEsc(eventTosName(slug, toses))}</option>`).join('');

    function apply() {
      const query = (search?.value || '').toLowerCase().trim().replace(/ё/g, 'е');
      const selectedType = type?.value || '';
      const selectedTos = tos?.value || '';
      const filtered = events
        .filter((item) => !selectedType || item.type === selectedType)
        .filter((item) => !selectedTos || item.tos_slug === selectedTos)
        .filter((item) => {
          const tosName = eventTosName(item.tos_slug, toses);
          const hay = [item.title, item.description, item.type, item.place, item.source, tosName, eventSourceKind(item), eventDateState(item).label].join(' ').toLowerCase().replace(/ё/g, 'е');
          return !query || hay.includes(query);
        })
        .sort((a, b) => {
          const pastDifference = Number(eventIsPast(a)) - Number(eventIsPast(b));
          if (pastDifference) return pastDifference;
          return eventIsPast(a)
            ? String(eventDateValue(b)).localeCompare(String(eventDateValue(a)))
            : String(eventDateValue(a)).localeCompare(String(eventDateValue(b)));
        });
      root.innerHTML = filtered.length ? filtered.map((item) => eventCard(item, toses)).join('') : '<div class="empty">События не найдены.</div>';
    }

    [search, type, tos].forEach((element) => element?.addEventListener('input', apply));
    apply();
  } catch {
    root.innerHTML = '<div class="empty">Календарь не загрузился. Проверьте файл data/events.json</div>';
  }
}

renderEvents();
