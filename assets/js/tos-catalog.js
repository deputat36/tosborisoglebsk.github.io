async function renderImprovedTosCatalog(){
  const root=document.querySelector('#tos-list');
  const core=window.TosCatalogCore;
  const sortModes=['name','updated_desc','attention'];
  if(!root||!core)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=(v,f='Информация уточняется')=>(v===undefined||v===null||String(v).trim()==='')?f:String(v).trim();
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  const socialName=u=>!u?'Ссылка':u.includes('vk.com')||u.includes('vk.ru')?'ВКонтакте':u.includes('ok.ru')?'Одноклассники':u.includes('t.me')?'Telegram':'Ссылка';
  const hasGoodDescription=t=>t.description&&t.description.trim()&&t.description.trim()!=='Описание пока уточняется.';
  const cleanText=core.normalize;
  const normalizedLocation=raw=>{
    const s=cleanText(raw);
    if(!s)return 'Территория не указана';
    if(s.includes('чигорак'))return 'с. Чигорак';
    if(s.includes('борисоглебск'))return 'г. Борисоглебск';
    if(s.includes('богана'))return 'с. Богана';
    if(s.includes('губари'))return 'с. Губари';
    if(s.includes('ивановка'))return 'п. Ивановка';
    if(s.includes('калинино'))return 'п. Калинино';
    if(s.includes('махровка'))return 'с. Махровка';
    if(s.includes('миролюбие'))return 'п. Миролюбие';
    if(s.includes('петровское'))return 'с. Петровское';
    if(s.includes('подст'))return 'п. Подстёпки';
    if(s.includes('танцырей'))return 'с. Танцырей';
    if(s.includes('третьяки'))return 'с. Третьяки';
    if(s.includes('ульяновка'))return 'с. Ульяновка';
    return fmt(raw,'Территория не указана');
  };
  const verificationInfo=t=>({
    verified:{label:'Подтверждено источником',className:'ok'},
    partial:{label:'Проверено частично',className:'info'},
    stale:{label:'Нужно перепроверить',className:'bad'},
    needs_review:{label:'Требует проверки',className:'warn'}
  })[core.verificationStatus(t)];
  const verificationNote=t=>{
    const trust=t.trust||{};
    const scope=Array.isArray(trust.verification_scope)?trust.verification_scope:[];
    if(trust.checked_at&&trust.source_ref&&scope.length)return `Проверено по источнику: ${core.formatDateRu(trust.checked_at)}. Объём: ${scope.join(', ')}.`;
    return 'Проверка источника: дата, основание и объём не зафиксированы.';
  };
  const feature=(ok,text)=>`<span class="feature ${ok?'ok':'muted'}">${ok?'✓':'—'} ${esc(text)}</span>`;
  const logo=t=>t.logo?`<img class="tos-logo-img" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc(initials(t.name))}</div>'">`:`<div class="avatar">${esc(initials(t.name))}</div>`;
  function card(t){
    const verification=verificationInfo(t);
    const typeClass=t.type==='Городской'?'badge-city':'badge-village';
    const links=(t.social_links||[]).map(u=>`<a class="tag" target="_blank" rel="noopener" href="${esc(u)}">${socialName(u)}</a>`).join('');
    const correction=`/update-tos/?tos=${encodeURIComponent(t.slug)}&type=card#message-builder`;
    return `<article class="card tos-card improved-tos-card" data-verification="${core.verificationStatus(t)}" data-catalog-contact-policy="detail-only"><div class="card-inner"><div class="tos-top">${logo(t)}<div><h3>ТОС «${esc(fmt(t.name,''))}»</h3><p>${esc(normalizedLocation(t.location))} · <span class="tag ${typeClass}">${esc(fmt(t.type))}</span></p><span class="status-pill ${verification.className}"><span class="status-dot"></span>${esc(verification.label)}</span></div></div><p class="tos-description">${esc(fmt(t.description,'Описание пока уточняется.'))}</p><div class="tos-dates"><p><b>Изменено на сайте:</b> ${esc(core.formatDateRu(t.updated_at))}</p><p><b>${esc(verificationNote(t))}</b></p></div><div class="feature-row">${feature((t.phones||[]).length,'контакты в карточке')}${feature((t.social_links||[]).length,'соцсети')}${feature(hasGoodDescription(t),'описание')}${feature(Boolean(t.boundaries),'границы')}</div><div class="meta">${links||'<span class="tag warn">Публичные ссылки уточняются</span>'}</div><hr class="sep"/><p class="tiny"><b>Границы:</b> ${esc(fmt(t.boundaries))}</p><p class="tiny catalog-contact-policy"><b>Контакты и сведения о председателе:</b> доступны в основной карточке вместе со статусом проверки и пояснением источника.</p><div class="card-actions"><a class="btn primary" href="/tos/${esc(t.slug)}/">Открыть карточку</a><a class="btn" href="${correction}">Исправить эту карточку</a></div></div></article>`;
  }
  function renderSummary(items){
    const box=document.querySelector('#tos-summary');
    if(!box)return;
    const city=items.filter(t=>t.type==='Городской').length;
    const rural=items.filter(t=>t.type==='Сельский').length;
    const verified=items.filter(t=>core.verificationStatus(t)==='verified').length;
    const partial=items.filter(t=>core.verificationStatus(t)==='partial').length;
    const attention=items.filter(t=>['needs_review','stale'].includes(core.verificationStatus(t))).length;
    box.innerHTML=`<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>карточек найдено</span></div><div class="summary-tile"><b>${city}/${rural}</b><span>городских / сельских</span></div><div class="summary-tile"><b>${verified}</b><span>подтверждено</span></div><div class="summary-tile"><b>${partial}</b><span>проверено частично</span></div><div class="summary-tile"><b>${attention}</b><span>требуют внимания</span></div></div>`;
  }
  function renderResolution(items,value){
    const box=document.querySelector('#find-tos-guidance');
    if(!box)return;
    const resolution=core.resolutionState(items,value);
    box.dataset.resolution=resolution.kind;
    if(resolution.kind==='start'){
      box.innerHTML='<b>Как найти свой ТОС:</b> введите улицу, микрорайон, село или выберите территорию. Каталог покажет возможные карточки, но опубликованные сведения не заменяют официальный документ о границах.';
      return;
    }
    if(resolution.kind==='none'){
      box.innerHTML='<b>По опубликованным сведениям совпадений нет.</b> Попробуйте другое написание улицы или населённого пункта. Если результат не появился, передайте территорию редакции — она проверит каталог без публикации непроверенных данных.<div class="card-actions"><a class="btn primary" data-find-tos-request href="/contacts/?request=find-tos#relay-tos">Передать территорию редакции</a><button class="btn" type="button" data-find-tos-reset>Очистить поиск</button></div>';
      box.querySelector('[data-find-tos-reset]')?.addEventListener('click',()=>document.querySelector('#reset-filters')?.click());
      return;
    }
    if(resolution.kind==='single'){
      const item=items[0];
      box.innerHTML=`<b>Найдена одна возможная карточка: ТОС «${esc(item.name)}».</b> Откройте её и сверьте территорию, опубликованные границы, статус проверки и контакты. Совпадение поиска само по себе не подтверждает официальную принадлежность адреса.<div class="card-actions"><a class="btn primary" data-find-tos-card href="/tos/${esc(item.slug)}/">Открыть карточку</a><a class="btn" href="/contacts/?request=find-tos#relay-tos">Нужна помощь редакции</a></div>`;
      return;
    }
    box.innerHTML=`<b>Найдено возможных карточек: ${items.length}.</b> Сравните опубликованные границы и описания ниже. Если адрес остаётся неоднозначным, передайте территорию редакции для ручной проверки.<div class="card-actions"><a class="btn primary" href="#tos-list">Сравнить карточки</a><a class="btn" data-find-tos-request href="/contacts/?request=find-tos#relay-tos">Уточнить через редакцию</a></div>`;
  }
  try{
    const toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const published=toses.filter(item=>item&&item.status!=='draft');
    const count=document.querySelector('#tos-count');
    const search=document.querySelector('#search');
    const type=document.querySelector('#type-filter');
    const loc=document.querySelector('#location-filter');
    const trust=document.querySelector('#trust-filter');
    const sort=document.querySelector('#sort-filter');
    const reset=document.querySelector('#reset-filters');
    const filterStatus=document.querySelector('#catalog-filter-status');
    if(loc)loc.innerHTML='<option value="">Все территории</option>'+[...new Set(published.map(x=>normalizedLocation(x.location)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const initial=core.stateFromSearch(location.search);
    if(search)search.value=initial.q;
    if(type)type.value=initial.type;
    if(loc&&[...loc.options].some(option=>option.value===initial.location))loc.value=initial.location;
    if(trust)trust.value=initial.trust;
    if(sort)sort.value=sortModes.includes(initial.sort)?initial.sort:'name';
    function state(){const selectedSort=sort?.value||'name';return{q:search?.value||'',location:loc?.value||'',type:type?.value||'',trust:trust?.value||'',sort:sortModes.includes(selectedSort)?selectedSort:'name'};}
    function syncUrl(value){history.replaceState(null,'',`${location.pathname}${core.stateToSearch(value)}${location.hash||''}`);}
    function updateShortcuts(value){document.querySelectorAll('[data-catalog-trust]').forEach(button=>button.classList.toggle('primary',button.dataset.catalogTrust===value.trust));document.querySelectorAll('[data-catalog-sort]').forEach(button=>button.classList.toggle('primary',button.dataset.catalogSort===value.sort));}
    function apply(){
      const value=state();
      const items=core.filterAndSort(published,value,item=>normalizedLocation(item.location));
      root.innerHTML=items.length?items.map(card).join(''):'<div class="empty">По опубликованным сведениям ничего не найдено. Сбросьте фильтры, попробуйте другой вариант названия или передайте территорию редакции.</div>';
      if(count)count.textContent=items.length;
      renderSummary(items);
      renderResolution(items,value);
      syncUrl(value);
      updateShortcuts(value);
      const active=core.activeFilterCount(value);
      if(filterStatus)filterStatus.textContent=`Показано ${items.length} из ${published.length}. Активных условий: ${active}.`;
    }
    [search,type,loc,trust,sort].forEach(element=>element?.addEventListener('input',apply));
    document.querySelectorAll('[data-catalog-trust]').forEach(button=>button.addEventListener('click',()=>{if(trust)trust.value=trust.value===button.dataset.catalogTrust?'':button.dataset.catalogTrust;apply();}));
    document.querySelectorAll('[data-catalog-sort]').forEach(button=>button.addEventListener('click',()=>{if(sort)sort.value=sort.value===button.dataset.catalogSort?'name':button.dataset.catalogSort;apply();}));
    reset?.addEventListener('click',()=>{if(search)search.value='';if(type)type.value='';if(loc)loc.value='';if(trust)trust.value='';if(sort)sort.value='name';apply();search?.focus();});
    search?.addEventListener('keydown',event=>{if(event.key==='Escape'&&search.value){search.value='';apply();}});
    apply();
  }catch(error){root.innerHTML='<div class="empty">Каталог не загрузился. Откройте страницу позже или сообщите о проблеме редакции.</div>';}
}
renderImprovedTosCatalog();
