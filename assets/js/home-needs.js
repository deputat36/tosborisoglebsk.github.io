async function renderHomeNeeds(){
  const root=document.querySelector('#home-needs');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  try{
    const needs=await fetch('/data/needs.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]);
    const toses=await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]).catch(()=>[]);
    const weight={'Высокий':1,'Средний':2,'Низкий':3};
    const tosName=slug=>{const t=toses.find(x=>x.slug===slug);return t?'ТОС «'+t.name+'»':slug||''};
    const items=needs.filter(x=>x.status!=='draft').sort((a,b)=>(weight[a.priority]||9)-(weight[b.priority]||9)||String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
    root.innerHTML=items.length?items.map(n=>`<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(n.need_type||'Помощь')}</span><span class="tag">${esc(n.priority||'Приоритет уточняется')}</span></div><h3>${esc(n.title||'Потребность без названия')}</h3><p>${esc(n.description||'')}</p>${n.tos_slug?`<p class="tiny"><b>ТОС:</b> ${esc(tosName(n.tos_slug))}</p>`:''}<div class="card-actions"><a class="btn" href="/needs/">Подробнее</a><a class="btn" href="/contacts/">Предложить помощь</a>${n.tos_slug?`<a class="btn" href="/tos/${esc(n.tos_slug)}/">Открыть ТОС</a>`:''}</div></div></article>`).join(''):'<div class="empty">Актуальные потребности пока не добавлены.</div>';
  }catch(e){root.innerHTML='<div class="empty">Не удалось загрузить потребности ТОСов.</div>'}
}
renderHomeNeeds();
