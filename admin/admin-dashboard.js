(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function esc(v){
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  async function readDataset(key){
    try{
      const local = localStorage.getItem('tosbgo_admin_' + key);
      if(local) return JSON.parse(local);
      const cfg = window.DATASETS ? window.DATASETS[key] : null;
      const file = cfg?.file || `/data/${key}.json`;
      const res = await fetch(file, {cache:'no-store'});
      return res.ok ? await res.json() : [];
    }catch(e){ return []; }
  }

  function isPublished(x){ return x && x.status !== 'draft'; }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
  function soon(events){
    const today = new Date().toISOString().slice(0,10);
    return events.filter(e => isPublished(e) && (!e.date || e.date >= today)).length;
  }
  function pastPublished(events){
    const today = new Date().toISOString().slice(0,10);
    return events.filter(e => isPublished(e) && e.date && e.date < today).length;
  }
  function linkedCount(arr){ return arr.filter(x => isPublished(x) && x.tos_slug).length; }
  function noLinkedCount(arr){ return arr.filter(x => isPublished(x) && !x.tos_slug).length; }

  async function buildDashboard(){
    const root = document.querySelector('#dashboardSection');
    if(!root) return;
    root.innerHTML = '<div class="empty">Загрузка сводки...</div>';

    const [toses, news, articles, documents, grants, projects, events, needs] = await Promise.all([
      readDataset('toses'), readDataset('news'), readDataset('articles'), readDataset('documents'), readDataset('grants'), readDataset('projects'), readDataset('events'), readDataset('needs')
    ]);

    const publishedTos = toses.filter(isPublished);
    const stats = [
      ['ТОСов всего', publishedTos.length],
      ['Без телефона', publishedTos.filter(t => !(t.phones||[]).length).length],
      ['Без логотипа', publishedTos.filter(t => !t.logo).length],
      ['Без соцсетей', publishedTos.filter(t => !(t.social_links||[]).length).length],
      ['Новости', news.filter(isPublished).length],
      ['Новости в черновиках', news.filter(x => x.status === 'draft').length],
      ['Ближайшие события', soon(events)],
      ['Актуальные потребности', needs.filter(isPublished).length],
      ['Проекты', projects.filter(isPublished).length],
      ['Проекты без ТОС', noLinkedCount(projects)],
      ['Документы', documents.filter(isPublished).length],
      ['Конкурсы/гранты', grants.length]
    ];

    const knownSlugs = new Set(publishedTos.map(t => t.slug).filter(Boolean));
    const issues = [];

    publishedTos.filter(t => !(t.phones||[]).length).slice(0,8).forEach(t => issues.push({type:'ТОС без телефона', title:`ТОС «${t.name || t.slug || 'без названия'}»`, action:'Проверить контакты председателя'}));
    publishedTos.filter(t => !t.logo).slice(0,8).forEach(t => issues.push({type:'ТОС без логотипа', title:`ТОС «${t.name || t.slug || 'без названия'}»`, action:'Добавить путь к логотипу'}));
    [...news, ...projects, ...events, ...needs].filter(x => isPublished(x) && x.tos_slug && !knownSlugs.has(x.tos_slug)).slice(0,8).forEach(x => issues.push({type:'Неверный tos_slug', title:x.title || x.id || 'Запись без названия', action:`Не найден ТОС: ${x.tos_slug}`}));
    events.filter(e => isPublished(e) && e.date && e.date < new Date().toISOString().slice(0,10)).slice(0,8).forEach(e => issues.push({type:'Прошедшее событие', title:e.title || e.id || 'Событие', action:'Проверить статус или перенести дату'}));
    needs.filter(n => isPublished(n) && n.priority === 'Высокий' && !n.contact).slice(0,8).forEach(n => issues.push({type:'Потребность без контакта', title:n.title || n.id || 'Потребность', action:'Добавить контакт для связи'}));
    documents.filter(d => isPublished(d) && !d.url).slice(0,8).forEach(d => issues.push({type:'Документ без ссылки', title:d.title || 'Документ', action:'Добавить url'}));

    const chairRows = publishedTos.map(t => [
      t.name || '',
      t.location || '',
      t.chairperson || '',
      (t.phones || []).join(', '),
      (t.emails || []).join(', '),
      (t.chairperson_links || []).join(', '),
      (t.social_links || []).join(', ')
    ]);

    root.innerHTML = `
      <div class="dashboard-head">
        <div>
          <h2>Обзор сайта</h2>
          <p>Сводка по данным, заполненности и проблемным местам. Учитываются данные из JSON и локальных черновиков браузера.</p>
        </div>
        <div class="toolbar-actions">
          <button class="btn" id="refreshDashboard" type="button">Обновить сводку</button>
          <button class="btn" id="exportChairpersons" type="button">CSV председателей</button>
        </div>
      </div>
      <div class="dashboard-grid">
        ${stats.map(([label,value]) => `<div class="dash-card"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}
      </div>
      <div class="dashboard-columns">
        <div class="dash-panel">
          <h3>Что исправить в первую очередь</h3>
          ${issues.length ? `<div class="issue-list">${issues.slice(0,24).map(i => `<div class="issue-row"><span>${esc(i.type)}</span><b>${esc(i.title)}</b><em>${esc(i.action)}</em></div>`).join('')}</div>` : '<div class="empty">Критичных замечаний не найдено.</div>'}
        </div>
        <div class="dash-panel">
          <h3>Быстрая аналитика</h3>
          <div class="issue-list">
            <div class="issue-row"><span>Территории</span><b>${esc(unique(publishedTos.map(t=>t.location)).length)}</b><em>уникальных населённых пунктов / территорий</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(news))}</b><em>новостей привязано к ТОСам</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(events))}</b><em>событий привязано к ТОСам</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(needs))}</b><em>потребностей привязано к ТОСам</em></div>
            <div class="issue-row"><span>Материалы</span><b>${esc(articles.filter(isPublished).length)}</b><em>полезных материалов опубликовано</em></div>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#refreshDashboard')?.addEventListener('click', buildDashboard);
    document.querySelector('#exportChairpersons')?.addEventListener('click', () => {
      const header = ['ТОС','Населённый пункт','Председатель','Телефон','Email','Профиль председателя','Сообщество ТОС'];
      const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const csv = [header, ...chairRows].map(row => row.map(cell).join(';')).join('\n');
      if(typeof downloadText === 'function') downloadText('chairpersons-tos.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
    });
  }

  function installDashboard(){
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.workspace');
    if(!sidebar || !workspace || document.querySelector('[data-section="dashboard"]')) return;

    sidebar.insertAdjacentHTML('afterbegin', '<button class="tab" data-section="dashboard">Обзор</button>');
    workspace.insertAdjacentHTML('afterbegin', '<section id="dashboardSection" class="panel hidden"></section>');

    const dashboardBtn = document.querySelector('[data-section="dashboard"]');
    dashboardBtn.addEventListener('click', () => {
      document.querySelector('#editorSection')?.classList.add('hidden');
      document.querySelector('#helpSection')?.classList.add('hidden');
      document.querySelector('#dashboardSection')?.classList.remove('hidden');
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.section === 'dashboard'));
      buildDashboard();
    });

    document.querySelectorAll('.tab:not([data-section="dashboard"])').forEach(tab => {
      tab.addEventListener('click', () => document.querySelector('#dashboardSection')?.classList.add('hidden'));
    });
  }

  ready(() => {
    const wait = setInterval(() => {
      if(!document.querySelector('.sidebar') || !document.querySelector('.workspace')) return;
      clearInterval(wait);
      installDashboard();
    }, 50);
  });
})();
