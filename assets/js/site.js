const $ = (s, r = document) => r.querySelector(s);
const fmt = (v, f = 'Информация уточняется') => (v === undefined || v === null || String(v).trim() === '') ? f : String(v).trim();
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function ensureNavLink(href, text, afterHref){
  const nav = $('#site-nav');
  if(!nav || nav.querySelector(`a[href="${href}"]`)) return;
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  const anchor = afterHref ? nav.querySelector(`a[href="${afterHref}"]`) : null;
  if(anchor) anchor.insertAdjacentElement('afterend', link);
  else nav.appendChild(link);
}

function ensureImportantNav(){
  ensureNavLink('/legal/', 'Правовая основа', '/documents/');
  ensureNavLink('/editorial-policy/', 'О портале', '/contacts/');
}

function ensureFooterLinks(){
  const footerGrid = $('.footer .footer-grid') || $('.footer .container');
  if(!footerGrid || $('#footer-service-links')) return;
  const box = document.createElement('div');
  box.className = 'tiny';
  box.id = 'footer-service-links';
  box.innerHTML = `<b>Полезные ссылки</b><br><a href="/editorial-policy/">О портале</a> · <a href="/contacts/">Контакты</a> · <a href="/legal/">Правовая основа</a> · <a href="/documents/">Документы</a><br><a href="/update-tos/">Обновить данные ТОС</a> · <a href="https://vk.ru/tosbgo" target="_blank" rel="noopener">ВК-сообщество</a>`;
  footerGrid.appendChild(box);
}

function injectHomePortalStatus(){
  const isHome = location.pathname === '/' || location.pathname === '/index.html';
  if(!isHome || $('#home-portal-status')) return;
  const main = $('#main');
  if(!main) return;
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'home-portal-status';
  section.innerHTML = `<div class="container grid"><article class="card full"><div class="card-inner"><div class="eyebrow">Статус и доверие</div><h2>Как работает портал и кто может прислать материалы</h2><p>tosborisoglebsk.ru — информационный и рабочий портал для ТОСов Борисоглебского городского округа. Здесь можно найти карточки ТОС, новости, проекты, потребности, документы и полезные материалы для председателей и жителей.</p><div class="notice"><b style="color:var(--text)">Важно:</b> сайт не является официальным сайтом администрации. Для официальных действий нужно сверять документы, решения и правовую информацию с актуальными официальными источниками.</div><div class="grid"><article class="card"><div class="card-inner"><span class="tag">Материалы</span><h3>Что можно прислать</h3><p>Новость, фотоотчёт, обновление карточки ТОС, проект, потребность территории или сообщение об ошибке.</p></div></article><article class="card"><div class="card-inner"><span class="tag">Проверка</span><h3>Как оформляется публикация</h3><p>Материал уточняется, приводится к единому формату и привязывается к нужному ТОС или разделу сайта.</p></div></article></div><div class="card-actions"><a class="btn primary" href="/editorial-policy/">О портале</a><a class="btn" href="/contacts/">Прислать материал</a><a class="btn" href="/update-tos/">Обновить данные ТОС</a><a class="btn" href="/legal/">Правовая основа</a></div></div></article></div>`;
  const stats = $('#home-stats')?.closest('section');
  if(stats) main.insertBefore(section, stats);
  else main.appendChild(section);
}

function init(){
  ensureImportantNav();
  ensureFooterLinks();
  injectHomePortalStatus();
  const st = localStorage.getItem('theme');
  if(st === 'dark') document.documentElement.dataset.theme = 'dark';
  $('[data-action=theme]')?.addEventListener('click', () => {
    const d = document.documentElement.dataset.theme === 'dark';
    if(d){ delete document.documentElement.dataset.theme; localStorage.setItem('theme','light'); }
    else { document.documentElement.dataset.theme = 'dark'; localStorage.setItem('theme','dark'); }
  });
  $('[data-action=menu]')?.addEventListener('click', e => {
    $('#site-nav')?.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', $('#site-nav')?.classList.contains('open') ? 'true' : 'false');
  });
  const y = $('#year'); if(y) y.textContent = new Date().getFullYear();
}

async function getJSON(u){ const r = await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error(u); return r.json(); }
function socialName(u){ if(!u) return 'Ссылка'; if(u.includes('vk.com')) return 'ВКонтакте'; if(u.includes('ok.ru')) return 'Одноклассники'; if(u.includes('t.me')) return 'Telegram'; return 'Ссылка'; }
function initials(n){ return (n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || 'ТОС'; }
function phoneHref(p){ return String(p||'').replace(/[^+\d]/g,''); }
function isPublished(x){ return x.status !== 'draft'; }
function detailSlug(prefix){ const p = location.pathname.split('/').filter(Boolean); return p.length === 2 && p[0] === prefix ? p[1] : ''; }
function niceDate(value){ const d = new Date(String(value || '') + 'T00:00:00'); return Number.isNaN(d.getTime()) ? fmt(value,'Дата уточняется') : d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}); }
function setMeta(title, desc, url, img){
  document.title = title || document.title;
  const set = (sel, val) => { const el = $(sel); if(el && val) el.setAttribute(sel.startsWith('meta') ? 'content' : 'href', val); };
  set('meta[name="description"]', desc);
  set('link[rel="canonical"]', url);
  set('meta[property="og:title"]', title);
  set('meta[property="og:description"]', desc);
  set('meta[property="og:url"]', url);
  set('meta[property="og:image"]', img || 'https://tosborisoglebsk.ru/assets/img/og-cover.svg');
}

function tosCard(t){
  const links = (t.social_links||[]).map(u => `<a class="tag" target="_blank" rel="noopener" href="${esc(u)}">${socialName(u)}</a>`).join('');
  const typeClass = t.type === 'Городской' ? 'badge-city' : 'badge-village';
  return `<article class="card tos-card"><div class="card-inner"><div class="tos-top"><div class="avatar">${esc(initials(t.name))}</div><div><h3>ТОС «${esc(fmt(t.name,''))}»</h3><p>${esc(fmt(t.location))} · <span class="tag ${typeClass}">${esc(fmt(t.type))}</span></p></div></div><p style="margin-top:14px">${esc(fmt(t.description,'Описание пока уточняется.'))}</p><div class="meta"><span class="tag">${esc(fmt(t.founded))} год</span>${t.population?`<span class="tag">${esc(t.population)} жителей</span>`:''}${links||'<span class="tag">Соцсети уточняются</span>'}</div><hr class="sep"/><p class="tiny"><b>Председатель:</b> ${esc(fmt(t.chairperson))}<br><b>Границы:</b> ${esc(fmt(t.boundaries))}</p><div class="card-actions"><a class="btn" href="/tos/${esc(t.slug)}/">Открыть карточку</a></div></div></article>`;
}

async function renderTos(){
  const root = $('#tos-list'); if(!root) return;
  const count = $('#tos-count'), search = $('#search'), type = $('#type-filter'), loc = $('#location-filter');
  try{
    const data = (await getJSON('/data/toses.json')).filter(isPublished);
    const locs = [...new Set(data.map(x=>x.location).filter(Boolean))].sort();
    if(loc) loc.innerHTML = '<option value="">Все территории</option>' + locs.map(x=>`<option>${esc(x)}</option>`).join('');
    function apply(){
      const q=(search?.value||'').toLowerCase().trim(), tv=type?.value||'', lv=loc?.value||'';
      const f=data.filter(t=>{ const hay=[t.name,t.location,t.boundaries,t.chairperson,t.description,t.contacts_raw].join(' ').toLowerCase(); return (!q||hay.includes(q)) && (!tv||t.type===tv) && (!lv||t.location===lv); });
      root.innerHTML = f.length ? f.map(tosCard).join('') : '<div class="empty">По вашему запросу ничего не найдено.</div>';
      if(count) count.textContent = f.length;
    }
    [search,type,loc].forEach(el=>el?.addEventListener('input',apply)); apply();
  }catch(e){ root.innerHTML = '<div class="empty">Каталог не загрузился. Проверьте файл data/toses.json</div>'; }
}

function listItem(n, base){ return `<article class="list-item"><div class="meta"><span class="tag">${esc(n.category||n.date||'')}</span>${n.date?`<span class="tag">${esc(n.date)}</span>`:''}${n.tos_slug?`<span class="tag">ТОС: ${esc(n.tos_slug)}</span>`:''}</div><h3>${esc(n.title)}</h3><p>${esc(n.lead||'')}</p><div class="card-actions"><a class="btn" href="${base}${esc(n.id)}/">Открыть</a>${n.source_url?`<a class="btn" target="_blank" rel="noopener" href="${esc(n.source_url)}">Источник</a>`:''}</div></article>`; }
async function renderNews(){ const root=$('#news-list'); if(!root) return; const data=(await getJSON('/data/news.json')).filter(isPublished); root.innerHTML=data.map(n=>listItem(n,'/news/')).join(''); }
async function renderArticles(){ const root=$('#articles-list'); if(!root) return; const data=(await getJSON('/data/articles.json')).filter(isPublished); root.innerHTML=data.map(a=>listItem(a,'/materials/')).join(''); }

function docCard(d){
  const isArchive = String(d.status||'').toLowerCase().includes('утрат') || String(d.status||'').toLowerCase().includes('архив');
  return `<article class="list-item document-card ${d.type==='Шаблон'?'template-card':''}"><div class="meta"><span class="tag">${esc(d.type||'Документ')}</span>${d.status?`<span class="tag ${isArchive?'warn':''}">${esc(d.status)}</span>`:''}${d.date?`<span class="tag">${esc(d.date)}</span>`:''}</div><h3>${esc(d.title)}</h3><p>${esc(d.description||'')}</p>${d.use_for?`<div class="notice"><b style="color:var(--text)">Для чего использовать</b><br>${esc(d.use_for)}</div>`:''}${d.attention?`<p class="tiny"><b>На что обратить внимание:</b> ${esc(d.attention)}</p>`:''}<div class="card-actions">${d.url?`<a class="btn" href="/${esc(d.url)}" target="_blank" rel="noopener">Открыть документ</a>`:''}<a class="btn" href="/contacts/">Уточнить по документу</a></div></article>`;
}
async function renderDocs(){
  const root=$('#documents-list'); if(!root) return;
  const data=(await getJSON('/data/documents.json')).filter(isPublished);
  root.innerHTML=data.length?data.map(docCard).join(''):'<div class="empty">Документы пока не добавлены.</div>';
}

function grantCard(g){
  const prepare=(g.prepare||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  const projects=(g.project_links||[]).slice(0,6).map(id=>`<a class="tag" href="/projects/${esc(id)}/">${esc(id)}</a>`).join('');
  return `<article class="list-item grant-card"><div class="meta"><span class="tag">${esc(g.category||'Возможность')}</span><span class="tag warn">${esc(g.status||'Статус уточняется')}</span><span class="tag">Сложность: ${esc(g.difficulty||'уточняется')}</span>${g.amount?`<span class="tag">${esc(g.amount)}</span>`:''}</div><h3>${esc(g.title)}</h3><p><b>Срок:</b> ${esc(g.deadline||'проверять объявления')}</p><p><b>Когда начинать:</b> ${esc(g.start_prepare||'заранее')}</p><p><b>Кому подходит:</b> ${esc(g.who||'ТОС и актив жителей')}</p><p><b>Лучше всего для:</b> ${esc(g.best_for||g.directions||'проектов местного значения')}</p><p>${esc(g.note||'')}</p>${prepare?`<div class="notice"><b style="color:var(--text)">Что подготовить</b><ul>${prepare}</ul></div>`:''}${projects?`<p class="tiny"><b>Подходящие идеи из банка проектов:</b><br>${projects}</p>`:''}<div class="card-actions"><a class="btn" href="/projects/">Банк проектов</a><a class="btn" href="/contacts/">Задать вопрос</a>${g.source?`<a class="btn" target="_blank" rel="noopener" href="${esc(g.source)}">Источник</a>`:''}</div></article>`;
}
async function renderGrants(){ const root=$('#grants-list'); if(!root) return; const data=await getJSON('/data/grants.json'); root.innerHTML=data.map(grantCard).join(''); }
function projectCard(p){
  const steps=(p.steps||[]).slice(0,4).map(s=>`<li>${esc(s)}</li>`).join('');
  return `<article class="card project-card"><div class="card-inner"><div class="meta"><span class="tag">${esc(p.type||'Проект')}</span>${p.based_on?'<span class="tag">На основе практики ТОС</span>':''}${p.grant_logic?'<span class="tag">Под грантовую заявку</span>':''}</div><h3>${esc(p.title||'Проект ТОС')}</h3><p>${esc(p.description||'')}</p>${p.grant_logic?`<div class="notice"><b style="color:var(--text)">Грантовая логика</b><br>${esc(p.grant_logic)}</div>`:''}${p.based_on?`<p class="tiny"><b>Основа идеи:</b> ${esc(p.based_on)}</p>`:''}${p.tos_slug?`<p class="tiny"><b>Привязка к ТОС:</b> ${esc(p.tos_slug)}</p>`:''}${steps?`<hr class="sep"/><p class="tiny"><b>Первые шаги:</b></p><ul class="tiny">${steps}</ul>`:''}<div class="card-actions"><a class="btn" href="/projects/${esc(p.id)}/">Подробнее</a><a class="btn" href="/contacts/">Предложить проект</a></div></div></article>`;
}
async function renderProjects(){
  const root=$('#projects-list'); if(!root) return;
  const data=(await getJSON('/data/projects.json')).filter(isPublished);
  root.innerHTML=data.length?data.map(projectCard).join(''):'<div class="empty">Проекты пока не добавлены.</div>';
}

async function renderSearch(){
  const root=$('#search-results'), input=$('#site-search'); if(!root||!input) return;
  const [t,n,a,d,g,p,e,needs] = await Promise.all([getJSON('/data/toses.json'),getJSON('/data/news.json'),getJSON('/data/articles.json'),getJSON('/data/documents.json'),getJSON('/data/grants.json'),getJSON('/data/projects.json'),getJSON('/data/events.json').catch(()=>[]),getJSON('/data/needs.json').catch(()=>[])]);
  const all=[...t.filter(isPublished).map(x=>({type:'ТОС',title:'ТОС «'+x.name+'»',text:[x.location,x.boundaries,x.chairperson,x.description].join(' '),url:'/tos/'+x.slug+'/'})),...n.filter(isPublished).map(x=>({type:'Новость',title:x.title,text:[x.lead,(x.text||[]).join(' ')].join(' '),url:'/news/'+x.id+'/'})),...a.filter(isPublished).map(x=>({type:'Материал',title:x.title,text:[x.lead,(x.content||[]).join(' ')].join(' '),url:'/materials/'+x.id+'/'})),...d.filter(isPublished).map(x=>({type:'Документ',title:x.title,text:[x.type,x.status,x.description,x.use_for,x.attention,x.date].join(' '),url:x.url?'/'+x.url:'/documents/'})),...g.map(x=>({type:'Конкурс',title:x.title,text:[x.category,x.status,x.note,x.directions,x.who,x.best_for,x.difficulty,x.start_prepare,(x.prepare||[]).join(' '),(x.project_links||[]).join(' ')].join(' '),url:'/grants/'})),...p.filter(isPublished).map(x=>({type:'Проект',title:x.title,text:[x.type,x.description,x.grant_logic,x.based_on,(x.steps||[]).join(' ')].join(' '),url:'/projects/'+x.id+'/'})),...e.filter(isPublished).map(x=>({type:'Событие',title:x.title,text:[x.type,x.description,x.place,x.tos_slug].join(' '),url:'/calendar/'})),...needs.filter(isPublished).map(x=>({type:'Нужна помощь',title:x.title,text:[x.need_type,x.priority,x.description,x.contact,x.tos_slug].join(' '),url:'/needs/'})),{type:'Правовая основа',title:'Правовая основа ТОС простыми словами',text:'правовой навигатор документы устав БГО местное самоуправление создание ТОС председателю собрание конференция протокол устав проекты гранты отчётность',url:'/legal/'},{type:'О портале',title:'О портале и редакционная политика',text:'статус портала редакционная политика кто ведёт сайт проверка материалов не официальный сайт администрации сообщить об ошибке прислать новость обновить данные ТОС контакты ВК сообщество',url:'/editorial-policy/'}];
  function apply(){ const q=input.value.toLowerCase().trim(); const r=!q?all:all.filter(x=>[x.title,x.text,x.type].join(' ').toLowerCase().includes(q)); root.innerHTML=r.map(x=>`<article class="list-item"><span class="tag">${esc(x.type)}</span><h3>${esc(x.title)}</h3><p>${esc((x.text||'').slice(0,220))}${(x.text||'').length>220?'...':''}</p><a class="btn" href="${esc(x.url)}">Открыть</a></article>`).join('')||'<div class="empty">Ничего не найдено.</div>'; }
  input.addEventListener('input',apply); apply();
}

function newsSmall(n){ return `<article class="list-item"><div class="meta"><span class="tag">${esc(n.category||'Новость')}</span>${n.date?`<span class="tag">${esc(n.date)}</span>`:''}</div><h3>${esc(n.title)}</h3><p>${esc(n.lead||'')}</p><div class="card-actions"><a class="btn" href="/news/${esc(n.id)}/">Открыть</a>${n.source_url?`<a class="btn" target="_blank" rel="noopener" href="${esc(n.source_url)}">Источник</a>`:''}</div></article>`; }
function projectSmall(p){ return `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(p.type||'Проект')}</span>${p.grant_logic?'<span class="tag">Под грант</span>':''}</div><h3>${esc(p.title)}</h3><p>${esc(p.description||'')}</p>${p.grant_logic?`<p class="tiny"><b>Грантовая логика:</b> ${esc(p.grant_logic)}</p>`:''}${(p.steps||[]).length?`<hr class="sep"/><ul class="tiny">${p.steps.slice(0,4).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}<div class="card-actions"><a class="btn" href="/projects/${esc(p.id)}/">Подробнее</a></div></div></article>`; }
function needSmall(n){ return `<article class="list-item"><div class="meta"><span class="tag">${esc(n.need_type||'Помощь')}</span><span class="tag">${esc(n.priority||'Приоритет уточняется')}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.description||'')}</p><p class="tiny"><b>Контакт:</b> ${esc(n.contact||'Уточняется')}</p><div class="card-actions"><a class="btn" href="/needs/">Все потребности</a><a class="btn" href="/contacts/">Предложить помощь</a></div></article>`; }
function eventSmall(e){ return `<article class="list-item"><div class="meta"><span class="tag">${esc(e.type||'Событие')}</span><span class="tag">${esc(niceDate(e.date))}${e.time?' · '+esc(e.time):''}</span></div><h3>${esc(e.title)}</h3><p>${esc(e.description||'')}</p><p class="tiny"><b>Место:</b> ${esc(e.place||'Уточняется')}</p><div class="card-actions"><a class="btn" href="/calendar/">Открыть календарь</a>${e.source_url?`<a class="btn" target="_blank" rel="noopener" href="${esc(e.source_url)}">Источник</a>`:''}</div></article>`; }

async function renderTosDetail(){
  const slug=detailSlug('tos'); if(!slug) return; const main=$('#main'); if(!main) return;
  try{
    const [toses, news, projects, needs, events] = await Promise.all([getJSON('/data/toses.json'), getJSON('/data/news.json').catch(()=>[]), getJSON('/data/projects.json').catch(()=>[]), getJSON('/data/needs.json').catch(()=>[]), getJSON('/data/events.json').catch(()=>[])]);
    const t=toses.find(x=>x.slug===slug); if(!t) return;
    const phones=(t.phones||[]).map(p=>`<li><a href="tel:${esc(phoneHref(p))}">${esc(p)}</a></li>`).join('');
    const emails=(t.emails||[]).map(e=>`<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`).join('');
    const chair=(t.chairperson_links||[]).map(u=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">Профиль/ссылка — ${esc(u)}</a></li>`).join('');
    const social=(t.social_links||[]).map(u=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${socialName(u)} — ${esc(u)}</a></li>`).join('')||'<li>Информация уточняется</li>';
    const linkedEvents = (events||[]).filter(x=>isPublished(x)&&x.tos_slug===slug).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).slice(0,6);
    const linkedNeeds = (needs||[]).filter(x=>isPublished(x)&&x.tos_slug===slug).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6);
    const linkedNews = (news||[]).filter(x=>isPublished(x)&&x.tos_slug===slug).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6);
    const linkedProjects = (projects||[]).filter(x=>isPublished(x)&&x.tos_slug===slug).slice(0,6);
    const eventsBlock = linkedEvents.length ? `<section class="section"><div class="container section-head"><div><h2>События этого ТОС</h2><p>Собрания, субботники, дедлайны и мероприятия территории</p></div><a class="btn" href="/calendar/">Весь календарь</a></div><div class="container list">${linkedEvents.map(eventSmall).join('')}</div></section>` : '';
    const needsBlock = linkedNeeds.length ? `<section class="section"><div class="container section-head"><div><h2>Актуальные потребности этого ТОС</h2><p>Помощь, материалы, волонтёры и партнёрская поддержка</p></div><a class="btn" href="/needs/">Все потребности</a></div><div class="container list">${linkedNeeds.map(needSmall).join('')}</div></section>` : '';
    const newsBlock = linkedNews.length ? `<section class="section"><div class="container section-head"><div><h2>Новости этого ТОС</h2><p>Публикации, привязанные к карточке по полю tos_slug</p></div></div><div class="container list">${linkedNews.map(newsSmall).join('')}</div></section>` : '';
    const projectsBlock = linkedProjects.length ? `<section class="section"><div class="container section-head"><div><h2>Проекты этого ТОС</h2><p>Идеи, планы и реализованные инициативы</p></div></div><div class="container grid">${linkedProjects.map(projectSmall).join('')}</div></section>` : '';
    main.innerHTML=`<section class="hero"><div class="container hero-card"><a class="chip" href="/tos/">← Каталог ТОС</a><h1>ТОС «${esc(t.name)}»</h1><p class="lead">${esc(fmt(t.location))}</p></div></section><section class="section"><div class="container grid"><div class="card full"><div class="card-inner"><div class="kpi"><div class="tile"><b>${esc(fmt(t.population,'—'))}</b><span>примерно жителей</span></div><div class="tile"><b>${esc(fmt(t.founded,'—'))}</b><span>год создания</span></div><div class="tile"><b>${esc(fmt(t.type))}</b><span>тип ТОС</span></div></div><hr class="sep"/><div class="notice"><b style="color:var(--text)">Границы ТОС</b><br>${esc(fmt(t.boundaries))}</div><hr class="sep"/><div class="prose"><h2>Описание</h2><p>${esc(fmt(t.description,'Описание пока уточняется.'))}</p><h2>Председатель</h2><p>${esc(fmt(t.chairperson))}</p><h2>Контакты председателя</h2><ul>${phones}${emails}${chair||''}</ul><h2>Ссылки на сообщества ТОС</h2><ul>${social}</ul><p class="tiny">Исходные контакты из анкеты: ${esc(fmt(t.contacts_raw,'—'))}</p><p class="tiny">Источник/обновление: ${esc(fmt(t.updated_at,'дата уточняется'))}</p></div><hr class="sep"/><div class="card-actions"><a class="btn" href="/tos/">← В каталог</a><a class="btn" href="/update-tos/">Сообщить об ошибке</a><button class="btn" onclick="window.print()">Распечатать карточку</button></div></div></div></div></section>${eventsBlock}${needsBlock}${newsBlock}${projectsBlock}`;
    setMeta(`ТОС «${t.name}» — контакты, границы, председатель`,`${fmt(t.boundaries)} ${fmt(t.location)}`,`https://tosborisoglebsk.ru/tos/${slug}/`);
  }catch(e){ console.warn('Не удалось обновить карточку ТОС из JSON',e); }
}

async function renderNewsDetail(){
  const id=detailSlug('news'); if(!id) return; const main=$('#main'); if(!main) return;
  try{ const data=await getJSON('/data/news.json'); const n=data.find(x=>x.id===id); if(!n) return; const paragraphs=Array.isArray(n.text)?n.text.map(p=>`<p>${esc(p)}</p>`).join(''):`<p>${esc(n.text||n.lead||'')}</p>`; const image=n.image?`<img src="${esc(n.image)}" alt="${esc(n.title)}" style="width:100%;border-radius:24px;margin:18px 0;border:1px solid var(--line);">`:''; const tosLink=n.tos_slug?`<p><a class="btn" href="/tos/${esc(n.tos_slug)}/">Открыть связанный ТОС</a></p>`:''; main.innerHTML=`<section class="hero"><div class="container hero-card"><a class="chip" href="/news/">← Новости</a><div class="eyebrow">${esc(n.category||'Новости')} · ${esc(n.date||'')}</div><h1>${esc(n.title)}</h1><p class="lead">${esc(n.lead||'')}</p></div></section><section class="section"><div class="container prose">${image}${paragraphs}${tosLink}<hr class="sep"/><p class="source"><b>Источник:</b> ${esc(n.source||'Редакция портала')}${n.source_url?`<br><a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_url)}</a>`:''}</p></div></section>`; setMeta(`${n.title} | ТОС БГО`,n.lead||'',`https://tosborisoglebsk.ru/news/${id}/`,n.image||'https://tosborisoglebsk.ru/assets/img/og-cover.svg'); }catch(e){ console.warn('Не удалось обновить новость из JSON',e); }
}

async function renderArticleDetail(){
  const id=detailSlug('materials'); if(!id) return; const main=$('#main'); if(!main) return;
  try{ const data=await getJSON('/data/articles.json'); const a=data.find(x=>x.id===id); if(!a) return; const paragraphs=(a.content||[]).map(p=>`<p>${esc(p)}</p>`).join(''); main.innerHTML=`<section class="hero"><div class="container hero-card"><a class="chip" href="/materials/">← Материалы</a><div class="eyebrow">${esc(a.category||'Материал')}</div><h1>${esc(a.title)}</h1><p class="lead">${esc(a.lead||'')}</p></div></section><section class="section"><div class="container prose">${paragraphs}</div></section>`; setMeta(`${a.title} | ТОС БГО`,a.lead||'',`https://tosborisoglebsk.ru/materials/${id}/`); }catch(e){ console.warn('Не удалось обновить материал из JSON',e); }
}

init();renderTos();renderNews();renderArticles();renderDocs();renderGrants();renderProjects();renderSearch();renderTosDetail();renderNewsDetail();renderArticleDetail();
