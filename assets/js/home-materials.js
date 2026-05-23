async function renderHomeMaterials(){
  const root=document.querySelector('#home-materials');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  try{
    const articles=await fetch('/data/articles.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const items=articles
      .filter(a=>a.status!=='draft')
      .slice(0,6);
    root.innerHTML=items.length?items.map(a=>`<article class="card material-card"><div class="card-inner"><div class="meta"><span class="tag">${esc(a.category||'Материал')}</span></div><h3>${esc(a.title||'Полезный материал')}</h3><p>${esc(a.lead||'')}</p><div class="card-actions"><a class="btn" href="/materials/${esc(a.id)}/">Читать</a></div></div></article>`).join(''):'<div class="empty">Материалы пока не добавлены.</div>';
  }catch(e){
    root.innerHTML='<div class="empty">Не удалось загрузить материалы.</div>';
  }
}
renderHomeMaterials();
