async function enhanceTosLogos(){
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  const statusLabels={verified:'Данные проверены',partial:'Проверено частично',needs_review:'Требует проверки',unknown:'Данные уточняются',stale:'Проверка устарела'};
  let toses=[];
  try{toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[])}catch{return}
  const byName=new Map(toses.map(t=>[String(t.name||'').trim().toLowerCase(),t]));
  const bySlug=new Map(toses.map(t=>[t.slug,t]));

  function arr(v){return Array.isArray(v)?v.filter(Boolean):[]}
  function calcQuality(t){
    const checks=[t?.slug,t?.name,t?.type,t?.location,t?.boundaries,t?.founded,t?.chairperson,arr(t?.phones).length,arr(t?.emails).length,arr(t?.social_links).length,t?.population,t?.logo,t?.description&&t.description!=='Описание пока уточняется.',t?.updated_at];
    return Math.round(checks.filter(Boolean).length/checks.length*100);
  }
  function verification(t){
    const allowed=new Set(['verified','partial','needs_review','unknown']);
    let status=allowed.has(t?.verification_status)?t.verification_status:'';
    const date=t?.verified_at||t?.updated_at||'';
    const stamp=date?new Date(`${date}T00:00:00`).getTime():NaN;
    const ageDays=Number.isNaN(stamp)?null:Math.floor((Date.now()-stamp)/86400000);
    const stale=ageDays!==null&&ageDays>180;
    if(!status){
      if(!date)status='unknown';
      else status=calcQuality(t)>=80?'partial':'needs_review';
    }
    if(stale&&status!=='unknown')status='stale';
    return {status,label:statusLabels[status]||statusLabels.unknown,date,source:t?.verification_source||'',note:t?.verification_note||'',ageDays};
  }
  function updateUrl(t,type='card'){
    return `/update-tos/?tos=${encodeURIComponent(t.slug)}&type=${encodeURIComponent(type)}`;
  }
  function logoMarkup(t,large=false){
    if(t&&t.logo)return `<img class="tos-logo-img${large?' large':''}" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" data-fallback="${esc(initials(t.name))}">`;
    return `<div class="avatar${large?' large':''}">${esc(initials(t?.name))}</div>`;
  }
  function addStyles(){
    if(document.querySelector('#tos-verification-styles'))return;
    const style=document.createElement('style');
    style.id='tos-verification-styles';
    style.textContent=`.tos-verification-strip{padding:10px 0 0}.tos-verification-box{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:var(--card)}.tos-verification-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tos-verification-actions{display:flex;gap:8px;flex-wrap:wrap}.tos-verification-badge{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800}.tos-verification-badge[data-status=verified]{background:rgba(48,135,86,.14);color:#256b45}.tos-verification-badge[data-status=partial]{background:rgba(64,120,160,.14);color:#315f80}.tos-verification-badge[data-status=needs_review],.tos-verification-badge[data-status=stale]{background:rgba(196,92,71,.14);color:#984737}.tos-verification-badge[data-status=unknown]{background:rgba(130,130,130,.13);color:var(--muted)}.tos-card-verification{margin-top:8px}.tos-card-verification .tos-verification-badge{padding:5px 8px;font-size:11px}@media(max-width:620px){.tos-verification-box{display:grid}.tos-verification-actions .btn{flex:1;justify-content:center}}`;
    document.head.appendChild(style);
  }
  function catalogStatus(card,t){
    if(!t||card.querySelector('.tos-card-verification'))return;
    const info=verification(t);
    const node=document.createElement('div');
    node.className='tos-card-verification';
    node.innerHTML=`<span class="tos-verification-badge" data-status="${esc(info.status)}">${esc(info.label)}</span>`;
    const target=card.querySelector('.meta')||card.querySelector('.tos-top')||card.querySelector('.card-inner')||card;
    target.insertAdjacentElement('afterend',node);
  }
  function enhanceDetailLinks(t){
    if(!t)return;
    document.querySelectorAll('a[href="/update-tos/"],a[href="/contacts/"]').forEach(link=>{
      const text=(link.textContent||'').toLowerCase();
      if(text.includes('ошиб')||text.includes('уточн')||text.includes('данн'))link.href=updateUrl(t,'card');
      else if(text.includes('новост'))link.href=updateUrl(t,'news');
      else if(text.includes('проект'))link.href=updateUrl(t,'project');
      else if(text.includes('потреб'))link.href=updateUrl(t,'need');
      else if(text.includes('фото'))link.href=updateUrl(t,'photo');
    });
    document.querySelectorAll('a[href="/update-tos/#template-project"]').forEach(link=>{link.href=updateUrl(t,'project')});
    document.querySelectorAll('a[href="/update-tos/#template-need"]').forEach(link=>{link.href=updateUrl(t,'need')});
    document.querySelectorAll('a[href="/update-tos/#template-photo"]').forEach(link=>{link.href=updateUrl(t,'photo')});
  }
  function detailStatus(t,hero){
    if(!t||document.querySelector('.tos-verification-strip'))return;
    const info=verification(t);
    const details=[];
    if(info.date)details.push(`Сведения от ${info.date}`);
    if(info.source)details.push(`Источник: ${info.source}`);
    if(info.note)details.push(info.note);
    if(info.status==='stale'&&!info.note)details.push('С момента последней проверки прошло более 180 дней.');
    if(!details.length)details.push('Дата и источник проверки пока не указаны.');
    const section=document.createElement('section');
    section.className='tos-verification-strip';
    section.innerHTML=`<div class="container"><div class="tos-verification-box"><div class="tos-verification-main"><span class="tos-verification-badge" data-status="${esc(info.status)}">${esc(info.label)}</span><span class="tiny">${esc(details.join(' · '))}</span></div><div class="tos-verification-actions"><a class="btn" href="${esc(updateUrl(t,'card'))}">Уточнить данные</a><a class="btn" href="${esc(updateUrl(t,'news'))}">Прислать новость</a></div></div></div>`;
    const heroSection=hero.closest('.hero')||hero.parentElement;
    heroSection.insertAdjacentElement('afterend',section);
  }
  function apply(){
    addStyles();
    document.querySelectorAll('.tos-card').forEach(card=>{
      const h=card.querySelector('h3');
      const avatar=card.querySelector('.tos-top .avatar,.tos-top .tos-logo-img');
      if(!h)return;
      const name=h.textContent.replace('ТОС','').replace(/[«»"]/g,'').trim().toLowerCase();
      const t=byName.get(name);
      if(avatar&&t&&t.logo&&!avatar.classList.contains('tos-logo-img'))avatar.outerHTML=logoMarkup(t);
      catalogStatus(card,t);
    });
    const path=location.pathname.split('/').filter(Boolean);
    if(path[0]==='tos'&&path[1]){
      const t=bySlug.get(path[1]);
      const hero=document.querySelector('.hero-card h1');
      if(t&&hero&&!document.querySelector('.tos-detail-logo'))hero.insertAdjacentHTML('beforebegin',`<div class="tos-detail-logo">${logoMarkup(t,true)}</div>`);
      if(t&&hero){enhanceDetailLinks(t);detailStatus(t,hero)}
    }
  }
  document.addEventListener('error',event=>{
    const image=event.target;
    if(!(image instanceof HTMLImageElement)||!image.classList.contains('tos-logo-img'))return;
    const fallback=document.createElement('div');
    fallback.className=image.classList.contains('large')?'avatar large':'avatar';
    fallback.textContent=image.dataset.fallback||'ТОС';
    image.replaceWith(fallback);
  },true);
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
  apply();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
}

enhanceTosLogos();
