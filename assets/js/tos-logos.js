async function enhanceTosLogos(){
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=n=>(n||'ТОС').replace(/ТОС|«|»|"/gi,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'ТОС';
  let toses=[];
  try{toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[])}catch{return}
  const byName=new Map(toses.map(t=>[String(t.name||'').trim().toLowerCase(),t]));
  const bySlug=new Map(toses.map(t=>[t.slug,t]));
  function logoNode(t,large=false){
    if(t&&t.logo){return `<img class="tos-logo-img${large?' large':''}" src="${esc(t.logo)}" alt="Логотип ТОС «${esc(t.name)}»" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar',textContent:'${esc(initials(t.name))}'}))">`}
    return `<div class="avatar${large?' large':''}">${esc(initials(t?.name))}</div>`;
  }
  function apply(){
    document.querySelectorAll('.tos-card').forEach(card=>{
      const h=card.querySelector('h3');
      const avatar=card.querySelector('.tos-top .avatar,.tos-top .tos-logo-img');
      if(!h||!avatar)return;
      const name=h.textContent.replace('ТОС','').replace(/[«»"]/g,'').trim().toLowerCase();
      const t=byName.get(name);
      if(t&&t.logo&&!avatar.classList.contains('tos-logo-img')) avatar.outerHTML=logoNode(t);
    });
    const path=location.pathname.split('/').filter(Boolean);
    if(path[0]==='tos'&&path[1]){
      const t=bySlug.get(path[1]);
      const hero=document.querySelector('.hero-card h1');
      if(t&&hero&&!document.querySelector('.tos-detail-logo')){
        hero.insertAdjacentHTML('beforebegin',`<div class="tos-detail-logo">${logoNode(t,true)}</div>`);
      }
    }
  }
  apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
}

enhanceTosLogos();
