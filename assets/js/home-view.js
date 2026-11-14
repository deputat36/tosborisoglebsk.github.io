(function(root,factory){
  const core=typeof module==='object'&&module.exports?require('./home-discovery-core'):root.HomeDiscoveryCore;
  const media=typeof module==='object'&&module.exports?require('./news-media'):root.TosNewsMedia;
  const api=factory(core,media);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.HomeView=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(core,media){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={verified:'Подтверждено источником',partial:'Проверено частично',stale:'Нужно перепроверить',needs_review:'Требует проверки'};
  function row(item){
    if(!/^[a-z0-9-]+$/.test(item.slug||''))return '';
    const state=core.verificationStatus(item);
    return `<a class="home-search-result" href="/tos/${esc(item.slug)}/"><span><b>ТОС «${esc(item.name)}»</b><small>${esc(item.location||'Территория уточняется')}</small></span><span class="status-pill ${state==='verified'?'ok':state==='partial'?'info':'warn'}"><span class="status-dot" aria-hidden="true"></span>${esc(labels[state])}</span></a>`;
  }
  function directory(rows){
    const items=rows.filter(core.isPublished).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
    return items.slice(0,6).map(row).join('')+(items.length>6?`<details class="home-directory-more"><summary>Все ТОС в каталоге — ${items.length}</summary><div class="home-search-results">${items.slice(6).map(row).join('')}</div></details>`:'');
  }
  function date(value){const s=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'Дата уточняется';}
  function overview(value){
    const opportunities=(value.opportunities||[]).map(x=>`<article class="home-current-item"><span class="tag">Конкурс или акция</span><h3>${esc(x.title)}</h3><p class="home-deadline"><b>Срок:</b> ${esc(x.deadline)}</p><p><b>Поддержка:</b> ${esc(x.amount)}</p><a href="/grants/#grant-${esc(x.id)}">Условия и подготовка →</a></article>`).join('');
    const events=value.upcoming.slice(0,Math.max(0,2-(value.opportunities||[]).length)).map(x=>`<article class="home-current-item"><span class="tag">${x.source_url?'По опубликованному источнику':'Редакционный ориентир'}</span><h3>${esc(x.title)}</h3><p>${esc(date(x.date))}${x.time?' · '+esc(x.time):''}</p><a href="/calendar/">Посмотреть в календаре →</a></article>`).join('');
    const news=value.freshNews.map(x=>media?.presentation(x)||x).map(x=>`<article class="home-current-item"><span class="tag">Публикация</span><h3>${esc(x.title)}</h3><p>${esc(date(x.date))}</p><a href="/news/${esc(x.id)}/">Читать →</a></article>`).join('');
    return opportunities+news+events||'<div class="home-finder-empty">Посмотрите <a href="/calendar/">календарь</a> и <a href="/news/">последние публикации</a>.</div>';
  }
  return {row,directory,overview,esc};
});
