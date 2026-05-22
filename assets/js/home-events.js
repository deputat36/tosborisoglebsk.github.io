const homeEventEsc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const homeEventDate = (value) => {
  if(!value) return 'Дата уточняется';
  const d = new Date(value + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});
};

async function renderHomeEvents(){
  const root = document.querySelector('#home-events');
  if(!root) return;

  try{
    const [events, toses] = await Promise.all([
      fetch('/data/events.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []),
      fetch('/data/toses.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const today = new Date().toISOString().slice(0,10);
    const filtered = events
      .filter(e => e.status !== 'draft')
      .filter(e => !e.date || e.date >= today)
      .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(0,3);

    const tosName = (slug) => {
      if(!slug) return '';
      const found = toses.find(t => t.slug === slug);
      return found ? `ТОС «${found.name}»` : slug;
    };

    root.innerHTML = filtered.length ? filtered.map(e => {
      const linked = tosName(e.tos_slug);
      return `<article class="card"><div class="card-inner">
        <div class="meta"><span class="tag">${homeEventEsc(e.type || 'Событие')}</span><span class="tag">${homeEventEsc(homeEventDate(e.date))}${e.time ? ' · ' + homeEventEsc(e.time) : ''}</span></div>
        <h3>${homeEventEsc(e.title || 'Событие без названия')}</h3>
        <p>${homeEventEsc(e.description || '')}</p>
        ${linked ? `<p class="tiny"><b>ТОС:</b> ${homeEventEsc(linked)}</p>` : ''}
        <div class="card-actions"><a class="btn" href="/calendar/">В календарь</a>${e.tos_slug ? `<a class="btn" href="/tos/${homeEventEsc(e.tos_slug)}/">Открыть ТОС</a>` : ''}</div>
      </div></article>`;
    }).join('') : '<div class="empty">Ближайшие события пока не добавлены.</div>';
  }catch(e){
    root.innerHTML = '<div class="empty">Не удалось загрузить ближайшие события.</div>';
  }
}

renderHomeEvents();
