const eventEsc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const eventFmtDate = (value) => {
  if(!value) return 'Дата уточняется';
  const d = new Date(value + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});
};
const eventIsPublished = (x) => x.status !== 'draft';

async function loadCalendarData(){
  const [events, toses] = await Promise.all([
    fetch('/data/events.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []),
    fetch('/data/toses.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []).catch(() => [])
  ]);
  return {events: events.filter(eventIsPublished), toses};
}

function eventTosName(slug, toses){
  if(!slug) return '';
  const found = toses.find(t => t.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function eventCard(e, toses){
  const tosName = eventTosName(e.tos_slug, toses);
  return `<article class="list-item">
    <div class="meta">
      <span class="tag">${eventEsc(e.type || 'Событие')}</span>
      <span class="tag">${eventEsc(eventFmtDate(e.date))}${e.time ? ' · ' + eventEsc(e.time) : ''}</span>
      ${tosName ? `<span class="tag">${eventEsc(tosName)}</span>` : ''}
    </div>
    <h3>${eventEsc(e.title || 'Событие без названия')}</h3>
    <p>${eventEsc(e.description || '')}</p>
    <p class="tiny"><b>Место:</b> ${eventEsc(e.place || 'Уточняется')}</p>
    <div class="card-actions">
      ${e.tos_slug ? `<a class="btn" href="/tos/${eventEsc(e.tos_slug)}/">Открыть ТОС</a>` : ''}
      ${e.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${eventEsc(e.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

async function renderCalendar(){
  const root = document.querySelector('#events-list');
  if(!root) return;
  const search = document.querySelector('#event-search');
  const type = document.querySelector('#event-type-filter');
  const tos = document.querySelector('#event-tos-filter');

  try{
    const {events, toses} = await loadCalendarData();
    const types = [...new Set(events.map(e => e.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const usedTos = [...new Set(events.map(e => e.tos_slug).filter(Boolean))];
    if(type) type.innerHTML = '<option value="">Все типы</option>' + types.map(t => `<option>${eventEsc(t)}</option>`).join('');
    if(tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map(slug => `<option value="${eventEsc(slug)}">${eventEsc(eventTosName(slug, toses))}</option>`).join('');

    function apply(){
      const q = (search?.value || '').toLowerCase().trim();
      const tv = type?.value || '';
      const sv = tos?.value || '';
      const filtered = events
        .filter(e => !tv || e.type === tv)
        .filter(e => !sv || e.tos_slug === sv)
        .filter(e => {
          const tosName = eventTosName(e.tos_slug, toses);
          const hay = [e.title, e.description, e.type, e.place, e.source, tosName].join(' ').toLowerCase();
          return !q || hay.includes(q);
        })
        .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
      root.innerHTML = filtered.length ? filtered.map(e => eventCard(e, toses)).join('') : '<div class="empty">События не найдены.</div>';
    }
    [search,type,tos].forEach(el => el?.addEventListener('input', apply));
    apply();
  }catch(e){
    root.innerHTML = '<div class="empty">Календарь не загрузился. Проверьте файл data/events.json</div>';
  }
}

renderCalendar();
