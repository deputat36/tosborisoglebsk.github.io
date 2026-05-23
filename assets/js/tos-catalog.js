async function renderImprovedTosCatalog(){
  const root=document.querySelector('#tos-list');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=(v,f='Информация уточняется')=>(v===undefined||v===null||String(v).trim()==='')?f:String(v).trim();
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  const socialName=u=>!u?'Ссылка':u.includes('vk.com')?'ВКонтакте':u.includes('ok.ru')?'Одноклассники':u.includes('t.me')?'Telegram':'Ссылка';
  const isPublished=x=>x.status!=='draft';
  const hasGoodDescription=t=>t.description&&t.description.trim()&&t.description.trim()!=='Описание пока уточняется.';
  const score=t=>{
    const checks=[t.name,t.location,t.boundaries,t.chairperson,(t.phones||[]).length,(t.emails||[]).length,(t.social_links||[]).length,t.logo,hasGoodDescription(t),t.population,t.founded];
    return Math.round(checks.filter(Boolean).length/checks.length*100);
  };
  const scoreClass=s=>s>=80?'ok':s>=55?'warn':'bad';
  const feature=(ok,text)=>`<span class="feature ${ok?'ok':'muted'}">${ok?'✓':'—'} ${esc(text)}</span>`;
  const logo=t=>t.logo?`<img class="tos-logo-img" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc(initials(t.name))}</div>'">`:`<div class="avatar">${esc(initials(t.name))}</div>`;
  function card(t){
    const s=score(t);
    const typeClass=t.type==='Городской'?'badge-city':'badge-village';
    const links=(t.social_links||[]).map(u=>`<a class="tag" target="_blank" rel="noopener" href="${esc(u)}">${socialName(u)}</a>`).join('');
    return `<article class="card tos-card improved-tos-card" data-score="${s}"><div class="card-inner"><div class="tos-quality ${scoreClass(s)}"><span>Заполнено ${s}%</span><i style="width:${s}%"></i></div><div class="tos-top">${logo(t)}<div><h3>ТОС «${esc(fmt(t.name,''))}»</h3><p>${esc(fmt(t.location))} · <span class="tag ${typeClass}">${esc(fmt(t.type))}</span></p></div></div><p style="margin-top:14px">${esc(fmt(t.description,'Описание пока уточняется.'))}</p><div class="feature-row">${feature((t.phones||[]).length,'телефон')}${feature((t.emails||[]).length,'email')}${feature((t.social_links||[]).length,'соцсети')}${feature(t.logo,'логотип')}${feature(hasGoodDescription(t),'описание')}</div><div class="meta"><span class="tag">${esc(fmt(t.founded))} год</span>${t.population?`<span class="tag">${esc(t.population)} жителей</span>`:''}${links||'<span class="tag warn">Соцсети уточняются</span>'}</div><hr class="sep"/><p class="tiny"><b>Председатель:</b> ${esc(fmt(t.chairperson))}<br><b>Границы:</b> ${esc(fmt(t.boundaries))}</p><div class="card-actions"><a class="btn" href="/tos/${esc(t.slug)}/">Открыть карточку</a><a class="btn" href="/update-tos/">Исправить данные</a></div></div></article>`;
  }
  try{
    const data=(await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[])).filter(isPublished);
    const count=document.querySelector('#tos-count');
    const search=document.querySelector('#search');
    const type=document.querySelector('#type-filter');
    const loc=document.querySelector('#location-filter');
    const contact=document.querySelector('#contact-filter');
    const fill=document.querySelector('#fill-filter');
    const sort=document.querySelector('#sort-filter');
    if(loc)loc.innerHTML='<option value="">Все территории</option>'+[...new Set(data.map(x=>x.location).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');
    function apply(){
      const q=(search?.value||'').toLowerCase().trim();
      const tv=type?.value||'';
      const lv=loc?.value||'';
      const cv=contact?.value||'';
      const fv=fill?.value||'';
      const sv=sort?.value||'name';
      let items=data.filter(t=>{
        const hay=[t.name,t.location,t.boundaries,t.chairperson,t.description,t.contacts_raw,(t.social_links||[]).join(' ')].join(' ').toLowerCase();
        const s=score(t);
        let ok=true;
        if(q)ok=ok&&hay.includes(q);
        if(tv)ok=ok&&t.type===tv;
        if(lv)ok=ok&&t.location===lv;
        if(cv==='phone')ok=ok&&(t.phones||[]).length>0;
        if(cv==='no-phone')ok=ok&&!(t.phones||[]).length;
        if(cv==='social')ok=ok&&(t.social_links||[]).length>0;
        if(cv==='no-social')ok=ok&&!(t.social_links||[]).length;
        if(cv==='email')ok=ok&&(t.emails||[]).length>0;
        if(fv==='no-logo')ok=ok&&!t.logo;
        if(fv==='low')ok=ok&&s<55;
        if(fv==='medium')ok=ok&&s>=55&&s<80;
        if(fv==='good')ok=ok&&s>=80;
        return ok;
      });
      items.sort((a,b)=>{
        if(sv==='score-desc')return score(b)-score(a);
        if(sv==='score-asc')return score(a)-score(b);
        if(sv==='year-desc')return String(b.founded||'').localeCompare(String(a.founded||''));
        if(sv==='location')return String(a.location||'').localeCompare(String(b.location||''),'ru');
        return String(a.name||'').localeCompare(String(b.name||''),'ru');
      });
      root.innerHTML=items.length?items.map(card).join(''):'<div class="empty">По вашему запросу ничего не найдено.</div>';
      if(count)count.textContent=items.length;
    }
    [search,type,loc,contact,fill,sort].forEach(el=>el?.addEventListener('input',apply));
    apply();
  }catch(e){root.innerHTML='<div class="empty">Каталог не загрузился. Проверьте файл data/toses.json</div>';}
}
renderImprovedTosCatalog();
