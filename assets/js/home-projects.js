async function renderHomeProjects(){
  const root=document.querySelector('#home-projects');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  try{
    const projects=await fetch('/data/projects.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const items=projects
      .filter(p=>p.status!=='draft')
      .slice(0,6);
    root.innerHTML=items.length?items.map(p=>{
      const steps=Array.isArray(p.steps)?p.steps.slice(0,3):[];
      return `<article class="card project-card"><div class="card-inner"><div class="meta"><span class="tag">${esc(p.type||'Проект')}</span>${p.tos_slug?`<span class="tag ok">Привязан к ТОС</span>`:''}</div><h3>${esc(p.title||'Идея проекта')}</h3><p>${esc(p.description||'')}</p>${steps.length?`<div class="quick-list">${steps.map(s=>`<div>${esc(s)}</div>`).join('')}</div>`:''}<div class="card-actions" style="margin-top:14px"><a class="btn" href="/projects/${esc(p.id)}/">Подробнее</a>${p.tos_slug?`<a class="btn" href="/tos/${esc(p.tos_slug)}/">ТОС</a>`:''}</div></div></article>`;
    }).join(''):'<div class="empty">Идеи проектов пока не добавлены.</div>';
  }catch(e){
    root.innerHTML='<div class="empty">Не удалось загрузить идеи проектов.</div>';
  }
}
renderHomeProjects();
