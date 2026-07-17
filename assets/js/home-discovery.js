document.addEventListener('DOMContentLoaded',()=>{
  const core=window.HomeDiscoveryCore;
  const input=document.querySelector('#home-tos-search');
  const clear=document.querySelector('#home-tos-search-clear');
  const resultsRoot=document.querySelector('#home-tos-search-results');
  const overviewRoot=document.querySelector('#home-current-overview');
  if(!core||(!resultsRoot&&!overviewRoot))return;

  const statusMap={
    verified:{label:'Подтверждено источником',className:'ok'},
    partial:{label:'Проверено частично',className:'info'},
    stale:{label:'Нужно перепроверить',className:'bad'},
    needs_review:{label:'Требует проверки',className:'warn'}
  };
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatDate=(value,withTime=false)=>{
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return'дата уточняется';
    return new Intl.DateTimeFormat('ru-RU',withTime?{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'long',year:'numeric'}).format(date);
  };
  async function getJson(url,fallback){try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():fallback;}catch{return fallback;}}

  function setupFinder(toses){
    if(!input||!resultsRoot)return;
    function render(){
      const query=input.value.trim();
      if(!query){resultsRoot.innerHTML='<div class="home-finder-empty">Введите название ТОС, населённый пункт, улицу, микрорайон или фамилию председателя.</div>';return;}
      if(core.normalize(query).length<2){resultsRoot.innerHTML='<div class="home-finder-empty">Введите минимум два символа.</div>';return;}
      const items=core.searchToses(toses,query);
      if(!items.length){resultsRoot.innerHTML='<div class="home-finder-empty"><b>Совпадений в опубликованном каталоге нет.</b><br>Попробуйте другой вариант или передайте уточнение редакции.<div class="card-actions"><a class="btn" href="/update-tos/?type=card#message-builder">Сообщить адрес или исправление</a></div></div>';return;}
      resultsRoot.innerHTML=items.map(item=>{
        const status=statusMap[core.verificationStatus(item)];
        return `<a class="home-search-result" href="/tos/${esc(item.slug)}/"><span><b>ТОС «${esc(item.name||'Без названия')}»</b><small>${esc(item.location||'Территория уточняется')}</small></span><span class="status-pill ${esc(status.className)}"><span class="status-dot"></span>${esc(status.label)}</span></a>`;
      }).join('');
    }
    input.addEventListener('input',render);
    input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';render();}});
    clear?.addEventListener('click',()=>{input.value='';input.focus();render();});
    render();
  }

  function renderOverview(overview){
    if(!overviewRoot)return;
    const catalog=overview.catalog||{};
    const generated=overview.generatedAt?`<article class="home-current-item"><span class="tag">Техническая сборка</span><h3>${esc(formatDate(overview.generatedAt,true))}</h3><p>Это дата автоматического обновления сайта, а не дата проверки контактов, границ или полномочий.</p></article>`:'';
    const catalogCard=`<article class="home-current-item"><span class="tag">Каталог</span><h3>${esc(catalog.total_tos??'24')} карточки ТОС</h3><p>Подтверждено полностью: ${esc(catalog.verified_count??0)}. Требуют проверки: ${esc(catalog.needs_review_count??'уточняется')}.</p><a href="/data-quality/">Посмотреть качество данных →</a></article>`;
    const events=overview.upcoming.length?overview.upcoming.map(item=>`<article class="home-current-item"><span class="tag ${item.source_url?'info':'warn'}">${item.source_url?'По опубликованному источнику':'Редакционный ориентир'}</span><h3>${esc(item.title||'Событие')}</h3><p><b>${esc(formatDate(`${item.date}T${item.time||'12:00'}:00`))}</b>${item.place?` · ${esc(item.place)}`:''}</p><div class="card-actions"><a href="/calendar/">Открыть календарь</a>${item.source_url?`<a target="_blank" rel="noopener" href="${esc(item.source_url)}">Источник</a>`:''}</div></article>`).join(''):'<article class="home-current-item"><span class="tag warn">Календарь</span><h3>Ближайшие даты не опубликованы</h3><p>Проверьте календарь или передайте редакции подтверждённое событие.</p><a href="/calendar/">Открыть календарь →</a></article>';
    const news=overview.freshNews.length?overview.freshNews.map(item=>`<article class="home-current-item"><span class="tag">Свежая публикация</span><h3>${esc(item.title||'Новость')}</h3><p>${esc(formatDate(`${item.date}T12:00:00`))} · ${esc(item.source||'Источник указан в публикации')}</p><a href="/news/${esc(item.id)}/">Открыть публикацию →</a></article>`).join(''):`<article class="home-current-item attention"><span class="tag warn">Нужны свежие сведения</span><h3>За последние ${esc(overview.freshDays)} дней новых опубликованных новостей нет</h3><p>${overview.latestNews?`Последняя публикация датирована ${esc(formatDate(`${overview.latestNews.date}T12:00:00`))}. `:''}Черновики и неподтверждённые сообщения не выдаются за новости.</p><div class="card-actions"><a href="/update-tos/?type=news#message-builder">Прислать новость</a><a href="/news/">Архив публикаций</a></div></article>`;
    overviewRoot.innerHTML=`${generated}${catalogCard}${events}${news}`;
  }

  Promise.all([
    getJson('/data/toses.json',[]),
    getJson('/data/events.json',[]),
    getJson('/data/news.json',[]),
    getJson('/data/site_health.json',{})
  ]).then(([toses,events,news,health])=>{
    setupFinder(toses);
    renderOverview(core.buildCurrentOverview({events,news,health}));
  });
});
