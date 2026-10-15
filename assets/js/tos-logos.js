async function enhanceTosLogos(){
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  let toses=[];
  try{toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[])}catch{return}
  const byName=new Map(toses.map(t=>[String(t.name||'').trim().toLowerCase(),t]));
  const bySlug=new Map(toses.map(t=>[t.slug,t]));

  function updateUrl(t,type='card'){
    return `/update-tos/?tos=${encodeURIComponent(t.slug||'')}&type=${encodeURIComponent(type)}#message-builder`;
  }
  function logoMarkup(t,large=false){
    if(t&&t.logo)return `<img class="tos-logo-img${large?' large':''}" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" data-fallback="${esc(initials(t.name))}">`;
    return `<div class="avatar${large?' large':''}">${esc(initials(t?.name))}</div>`;
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
  function apply(){
    document.querySelectorAll('.tos-card').forEach(card=>{
      const h=card.querySelector('h3');
      const avatar=card.querySelector('.tos-top .avatar,.tos-top .tos-logo-img');
      if(!h)return;
      const name=h.textContent.replace('ТОС','').replace(/[«»"]/g,'').trim().toLowerCase();
      const t=byName.get(name);
      if(avatar&&t&&t.logo&&!avatar.classList.contains('tos-logo-img'))avatar.outerHTML=logoMarkup(t);
    });
    const path=location.pathname.split('/').filter(Boolean);
    if(path[0]==='tos'&&path[1]){
      const t=bySlug.get(path[1]);
      const hero=document.querySelector('.hero-card h1');
      if(t&&hero&&!document.querySelector('.tos-detail-logo'))hero.insertAdjacentHTML('beforebegin',`<div class="tos-detail-logo">${logoMarkup(t,true)}</div>`);
      if(t&&hero)enhanceDetailLinks(t);
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