(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function esc(v){
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  async function readDataset(key, fallbackFile){
    try{
      const local = localStorage.getItem('tosbgo_admin_' + key);
      if(local) return JSON.parse(local);
      const cfg = typeof DATASETS !== 'undefined' ? DATASETS[key] : null;
      const file = cfg?.file || fallbackFile || `/data/${key}.json`;
      const res = await fetch(file, {cache:'no-store'});
      return res.ok ? await res.json() : [];
    }catch(e){ return []; }
  }

  function isPublished(item){ return item && item.status !== 'draft'; }
  function unique(values){ return [...new Set(values.filter(Boolean))]; }
  function soon(events){
    const today = new Date().toISOString().slice(0,10);
    return events.filter(item => isPublished(item) && (!item.date || item.date >= today)).length;
  }
  function linkedCount(items){ return items.filter(item => isPublished(item) && item.tos_slug).length; }
  function noLinkedCount(items){ return items.filter(item => isPublished(item) && !item.tos_slug).length; }
  function resultNeedsEvidence(item){
    if(!isPublished(item)) return false;
    return item.content_origin !== 'verified' || !item.source_url || Boolean(item.needs_details);
  }

  async function buildDashboard(){
    const root = document.querySelector('#dashboardSection');
    if(!root) return;
    root.innerHTML = '<div class="empty">Загрузка сводки...</div>';

    const [toses, news, articles, documents, grants, projects, done, events, needs] = await Promise.all([
      readDataset('toses','/data/toses.json'),
      readDataset('news','/data/news.json'),
      readDataset('articles','/data/articles.json'),
      readDataset('documents','/data/documents.json'),
      readDataset('grants','/data/grants.json'),
      readDataset('projects','/data/projects.json'),
      readDataset('done','/data/done.json'),
      readDataset('events','/data/events.json'),
      readDataset('needs','/data/needs.json')
    ]);

    const publishedTos = toses.filter(isPublished);
    const publishedDone = done.filter(isPublished);
    const doneNeedsEvidence = publishedDone.filter(resultNeedsEvidence);
    const stats = [
      ['ТОСов всего', publishedTos.length],
      ['Без телефона', publishedTos.filter(item => !(item.phones||[]).length).length],
      ['Без логотипа', publishedTos.filter(item => !item.logo).length],
      ['Без соцсетей', publishedTos.filter(item => !(item.social_links||[]).length).length],
      ['Новости', news.filter(isPublished).length],
      ['Новости в черновиках', news.filter(item => item.status === 'draft').length],
      ['Ближайшие события', soon(events)],
      ['Актуальные потребности', needs.filter(isPublished).length],
      ['Проекты', projects.filter(isPublished).length],
      ['Проекты без ТОС', noLinkedCount(projects)],
      ['Результатов', publishedDone.length],
      ['Результаты требуют подтверждения', doneNeedsEvidence.length],
      ['Документы', documents.filter(isPublished).length],
      ['Конкурсы/гранты', grants.length]
    ];

    const knownSlugs = new Set(publishedTos.map(item => item.slug).filter(Boolean));
    const issues = [];

    publishedTos.filter(item => !(item.phones||[]).length).slice(0,8).forEach(item => issues.push({type:'ТОС без телефона', title:`ТОС «${item.name || item.slug || 'без названия'}»`, action:'Проверить открытый канал связи и основание публикации'}));
    publishedTos.filter(item => !item.logo).slice(0,8).forEach(item => issues.push({type:'ТОС без логотипа', title:`ТОС «${item.name || item.slug || 'без названия'}»`, action:'Добавить путь только после получения допустимого файла'}));
    [...news, ...projects, ...done, ...events, ...needs].filter(item => isPublished(item) && item.tos_slug && !knownSlugs.has(item.tos_slug)).slice(0,8).forEach(item => issues.push({type:'Неверный tos_slug', title:item.title || item.id || 'Запись без названия', action:`Не найден ТОС: ${item.tos_slug}`}));
    events.filter(item => isPublished(item) && item.date && item.date < new Date().toISOString().slice(0,10)).slice(0,8).forEach(item => issues.push({type:'Прошедшее событие', title:item.title || item.id || 'Событие', action:'Проверить статус или перенести дату'}));
    needs.filter(item => isPublished(item) && item.priority === 'Высокий' && !item.contact).slice(0,8).forEach(item => issues.push({type:'Потребность без контакта', title:item.title || item.id || 'Потребность', action:'Добавить допустимый публичный канал связи'}));
    doneNeedsEvidence.slice(0,8).forEach(item => issues.push({type:'Результат требует подтверждения', title:item.title || item.id || 'Результат', action:item.needs_details || 'Добавить проверяемый источник и подтверждающие материалы'}));
    documents.filter(item => isPublished(item) && !item.url).slice(0,8).forEach(item => issues.push({type:'Документ без ссылки', title:item.title || 'Документ', action:'Добавить проверяемый URL'}));

    const chairRows = publishedTos.map(item => [
      item.name || '',
      item.location || '',
      item.chairperson || '',
      (item.phones || []).join(', '),
      (item.emails || []).join(', '),
      (item.chairperson_links || []).join(', '),
      (item.social_links || []).join(', ')
    ]);

    root.innerHTML = `
      <div class="dashboard-head">
        <div>
          <h2>Обзор сайта</h2>
          <p>Сводка по девяти открытым JSON-наборам и локальным черновикам браузера. Она не подтверждает факты и не публикует изменения.</p>
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
          <h3>Что проверить в первую очередь</h3>
          ${issues.length ? `<div class="issue-list">${issues.slice(0,24).map(item => `<div class="issue-row"><span>${esc(item.type)}</span><b>${esc(item.title)}</b><em>${esc(item.action)}</em></div>`).join('')}</div>` : '<div class="empty">Структурных замечаний не найдено.</div>'}
        </div>
        <div class="dash-panel">
          <h3>Быстрая аналитика</h3>
          <div class="issue-list">
            <div class="issue-row"><span>Территории</span><b>${esc(unique(publishedTos.map(item=>item.location)).length)}</b><em>уникальных населённых пунктов / территорий</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(news))}</b><em>новостей привязано к ТОСам</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(events))}</b><em>событий привязано к ТОСам</em></div>
            <div class="issue-row"><span>Привязка</span><b>${esc(linkedCount(needs))}</b><em>потребностей привязано к ТОСам</em></div>
            <div class="issue-row"><span>Результаты</span><b>${esc(linkedCount(done))}</b><em>результатов привязано к ТОСам</em></div>
            <div class="issue-row"><span>Проверка</span><b>${esc(doneNeedsEvidence.length)}</b><em>результатов требуют подтверждающих материалов</em></div>
            <div class="issue-row"><span>Материалы</span><b>${esc(articles.filter(isPublished).length)}</b><em>полезных материалов опубликовано</em></div>
          </div>
        </div>
      </div>
    `;

    document.querySelector('#refreshDashboard')?.addEventListener('click', buildDashboard);
    document.querySelector('#exportChairpersons')?.addEventListener('click', () => {
      const header = ['ТОС','Населённый пункт','Председатель','Телефон','Email','Профиль председателя','Сообщество ТОС'];
      const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
      const csv = [header, ...chairRows].map(row => row.map(cell).join(';')).join('\n');
      if(typeof downloadText === 'function'){
        downloadText('chairpersons-tos.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
        if(typeof msg === 'function') msg(['CSV председателей сформирован. Перед передачей проверьте допустимость распространения контактов.'], true);
      }
    });
  }

  function installDashboard(){
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.workspace');
    if(!sidebar || !workspace || document.querySelector('[data-section="dashboard"]')) return;

    sidebar.insertAdjacentHTML('afterbegin', '<button class="tab" data-section="dashboard" type="button">Обзор</button>');
    workspace.insertAdjacentHTML('afterbegin', '<section id="dashboardSection" class="panel hidden"></section>');

    const dashboardBtn = document.querySelector('[data-section="dashboard"]');
    dashboardBtn.addEventListener('click', () => {
      document.querySelector('#editorSection')?.classList.add('hidden');
      document.querySelector('#helpSection')?.classList.add('hidden');
      document.querySelector('#dashboardSection')?.classList.remove('hidden');
      document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.section === 'dashboard'));
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
