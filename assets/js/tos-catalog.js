async function renderImprovedTosCatalog(){
  const root=document.querySelector('#tos-list');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=(v,f='Информация уточняется')=>(v===undefined||v===null||String(v).trim()==='')?f:String(v).trim();
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  const socialName=u=>!u?'Ссылка':u.includes('vk.com')||u.includes('vk.ru')?'ВКонтакте':u.includes('ok.ru')?'Одноклассники':u.includes('t.me')?'Telegram':'Ссылка';
  const isPublished=x=>x&&x.status!=='draft';
  const hasGoodDescription=t=>t.description&&t.description.trim()&&t.description.trim()!=='Описание пока уточняется.';
  const cleanText=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[.,]/g,' ').replace(/\s+/g,' ').trim();
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
  const verificationStatus=t=>{
    const allowed=['verified','partial','stale','needs_review'];
    return allowed.includes(t.verification_status)?t.verification_status:'needs_review';
  };
  const verificationInfo=t=>{
    const status=verificationStatus(t);
    const map={
      verified:{label:'Подтверждено источником',className:'ok'},
      partial:{label:'Проверено частично',className:'info'},
      stale:{label:'Нужно перепроверить',className:'bad'},
      needs_review:{label:'Требует проверки',className:'warn'}
    };
    return map[status];
  };
  const verificationNote=t=>{
    const trust=t.trust||{};
    const scope=Array.isArray(trust.verification_scope)?trust.verification_scope:[];
    if(trust.checked_at&&trust.source_ref&&scope.length){
      return `Проверено: ${trust.checked_at}. Объём: ${scope.join(', ')}.`;
    }
    return 'Источник, дата и объём проверки не зафиксированы.';
  };
  const feature=(ok,text)=>`<span class="feature ${ok?'ok':'muted'}">${ok?'✓':'—'} ${esc(text)}</span>`;
  const logo=t=>t.logo?`<img class="tos-logo-img" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc(initials(t.name))}</div>'">`:`<div class="avatar">${esc(initials(t.name))}</div>`;
  function card(t){
    const verification=verificationInfo(t);
    const typeClass=t.type==='Городской'?'badge-city':'badge-village';
    const links=(t.social_links||[]).map(u=>`<a class="tag" target="_blank" rel="noopener" href="${esc(u)}">${socialName(u)}</a>`).join('');
    return `<article class="card tos-card improved-tos-card" data-verification="${verificationStatus(t)}"><div class="card-inner"><div class="tos-top">${logo(t)}<div><h3>ТОС «${esc(fmt(t.name,''))}»</h3><p>${esc(normalizedLocation(t.location))} · <span class="tag ${typeClass}">${esc(fmt(t.type))}</span></p><span class="status-pill ${verification.className}"><span class="status-dot"></span>${esc(verification.label)}</span></div></div><p style="margin-top:14px">${esc(fmt(t.description,'Описание пока уточняется.'))}</p><p class="tiny">${esc(verificationNote(t))}</p><div class="feature-row">${feature((t.phones||[]).length,'телефон')}${feature((t.social_links||[]).length,'соцсети')}${feature(hasGoodDescription(t),'описание')}${feature(Boolean(t.boundaries),'границы')}</div><div class="meta">${links||'<span class="tag warn">Публичные ссылки уточняются</span>'}</div><hr class="sep"/><p class="tiny"><b>Председатель:</b> ${esc(fmt(t.chairperson))}<br><b>Телефон:</b> ${esc(((t.phones||[]).join(', '))||'уточняется')}<br><b>Границы:</b> ${esc(fmt(t.boundaries))}</p><div class="card-actions"><a class="btn primary" href="/tos/${esc(t.slug)}/">Открыть карточку</a></div><p class="tiny"><a href="/update-tos/?type=card#message-builder">Сообщить исправление</a></p></div></article>`;
  }
  function renderSummary(items){
    const box=document.querySelector('#tos-summary');
    if(!box)return;
    const city=items.filter(t=>t.type==='Городской').length;
    const rural=items.filter(t=>t.type==='Сельский').length;
    const verified=items.filter(t=>verificationStatus(t)==='verified').length;
    const review=items.filter(t=>verificationStatus(t)==='needs_review'||verificationStatus(t)==='stale').length;
    box.innerHTML=`<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>карточек найдено</span></div><div class="summary-tile"><b>${city}</b><span>городских</span></div><div class="summary-tile"><b>${rural}</b><span>сельских</span></div><div class="summary-tile"><b>${verified}</b><span>подтверждено</span></div><div class="summary-tile"><b>${review}</b><span>требуют проверки</span></div></div>`;
  }
  try{
    const toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const published=toses.filter(isPublished).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru'));
    const count=document.querySelector('#tos-count');
    const search=document.querySelector('#search');
    const type=document.querySelector('#type-filter');
    const loc=document.querySelector('#location-filter');
    const trust=document.querySelector('#trust-filter');
    if(loc)loc.innerHTML='<option value="">Все территории</option>'+[...new Set(published.map(x=>normalizedLocation(x.location)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    function apply(){
      const q=cleanText(search?.value||'');
      const tv=type?.value||'';
      const lv=loc?.value||'';
      const vv=trust?.value||'';
      const items=published.filter(t=>{
        const normalized=normalizedLocation(t.location);
        const hay=cleanText([t.name,t.location,normalized,t.boundaries,t.chairperson,t.description,t.contacts_raw,(t.phones||[]).join(' '),(t.emails||[]).join(' '),(t.social_links||[]).join(' ')].join(' '));
        let ok=true;
        if(q)ok=ok&&hay.includes(q);
        if(tv)ok=ok&&t.type===tv;
        if(lv)ok=ok&&normalized===lv;
        if(vv)ok=ok&&verificationStatus(t)===vv;
        return ok;
      });
      root.innerHTML=items.length?items.map(card).join(''):'<div class="empty">По опубликованным сведениям ничего не найдено. Попробуйте другой вариант названия или сообщите уточнение.</div>';
      if(count)count.textContent=items.length;
      renderSummary(items);
    }
    [search,type,loc,trust].forEach(el=>el?.addEventListener('input',apply));
    apply();
  }catch(e){root.innerHTML='<div class="empty">Каталог не загрузился. Проверьте файл data/toses.json</div>';}
}
renderImprovedTosCatalog();
