const needsEsc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const needsFmtDate = (value) => {
  if(!value) return 'Дата уточняется';
  const d = new Date(value + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});
};
const needsPublished = (x) => x.status !== 'draft';

async function loadNeedsData(){
  const [needs, toses] = await Promise.all([
    fetch('/data/needs.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []),
    fetch('/data/toses.json', {cache:'no-store'}).then(r => r.ok ? r.json() : []).catch(() => [])
  ]);
  return {needs: needs.filter(needsPublished), toses};
}

function needsTosName(slug, toses){
  if(!slug) return '';
  const found = toses.find(t => t.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function needCard(item, toses){
  const tosName = needsTosName(item.tos_slug, toses);
  return `<article class="list-item">
    <div class="meta">
      <span class="tag">${needsEsc(item.need_type || 'Потребность')}</span>
      <span class="tag">${needsEsc(item.priority || 'Приоритет уточняется')}</span>
      <span class="tag">${needsEsc(needsFmtDate(item.date))}</span>
      ${tosName ? `<span class="tag">${needsEsc(tosName)}</span>` : ''}
    </div>
    <h3>${needsEsc(item.title || 'Потребность без названия')}</h3>
    <p>${needsEsc(item.description || '')}</p>
    <p class="tiny"><b>Контакт:</b> ${needsEsc(item.contact || 'Уточняется')}</p>
    <div class="card-actions">
      ${item.tos_slug ? `<a class="btn" href="/tos/${needsEsc(item.tos_slug)}/">Открыть ТОС</a>` : ''}
      <a class="btn" href="/contacts/">Предложить помощь</a>
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${needsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

async function renderNeeds(){
  const root = document.querySelector('#needs-list');
  if(!root) return;
  const search = document.querySelector('#needs-search');
  const type = document.querySelector('#needs-type-filter');
  const tos = document.querySelector('#needs-tos-filter');
  const priority = document.querySelector('#needs-priority-filter');

  try{
    const {needs, toses} = await loadNeedsData();
    const types = [...new Set(needs.map(n => n.need_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const priorities = [...new Set(needs.map(n => n.priority).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const usedTos = [...new Set(needs.map(n => n.tos_slug).filter(Boolean))];

    if(type) type.innerHTML = '<option value="">Все типы помощи</option>' + types.map(t => `<option>${needsEsc(t)}</option>`).join('');
    if(priority) priority.innerHTML = '<option value="">Любой приоритет</option>' + priorities.map(p => `<option>${needsEsc(p)}</option>`).join('');
    if(tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map(slug => `<option value="${needsEsc(slug)}">${needsEsc(needsTosName(slug, toses))}</option>`).join('');

    function apply(){
      const q = (search?.value || '').toLowerCase().trim();
      const tv = type?.value || '';
      const pv = priority?.value || '';
      const sv = tos?.value || '';
      const filtered = needs
        .filter(n => !tv || n.need_type === tv)
        .filter(n => !pv || n.priority === pv)
        .filter(n => !sv || n.tos_slug === sv)
        .filter(n => {
          const tosName = needsTosName(n.tos_slug, toses);
          const hay = [n.title, n.description, n.need_type, n.priority, n.contact, n.source, tosName].join(' ').toLowerCase();
          return !q || hay.includes(q);
        })
        .sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
      root.innerHTML = filtered.length ? filtered.map(n => needCard(n, toses)).join('') : '<div class="empty">Потребности не найдены.</div>';
    }

    [search,type,tos,priority].forEach(el => el?.addEventListener('input', apply));
    apply();
  }catch(e){
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/needs.json</div>';
  }
}

renderNeeds();
