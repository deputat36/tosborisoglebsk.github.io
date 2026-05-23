async function renderHomeNews(){
  const root=document.querySelector('#home-news');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const niceDate=v=>{
    const d=new Date(String(v||'')+'T00:00:00');
    return Number.isNaN(d.getTime())?String(v||''):d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  };
  try{
    const news=await fetch('/data/news.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const items=news
      .filter(n=>n.status!=='draft')
      .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
      .slice(0,4);
    root.innerHTML=items.length?items.map(n=>`<article class="card news-card"><div class="card-inner"><div class="meta"><span class="tag">${esc(n.category||'Новости')}</span>${n.date?`<span class="tag">${esc(niceDate(n.date))}</span>`:''}</div><h3>${esc(n.title||'Новость')}</h3><p>${esc(n.lead||'')}</p><div class="card-actions"><a class="btn" href="/news/${esc(n.id)}/">Читать</a>${n.tos_slug?`<a class="btn" href="/tos/${esc(n.tos_slug)}/">Связанный ТОС</a>`:''}</div></div></article>`).join(''):'<div class="empty">Новости пока не добавлены.</div>';
  }catch(e){
    root.innerHTML='<div class="empty">Не удалось загрузить новости.</div>';
  }
}
renderHomeNews();
