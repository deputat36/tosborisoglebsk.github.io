async function renderHomeStats(){
  const root=document.querySelector('#home-stats');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function get(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('unavailable');const a=await r.json();if(!Array.isArray(a))throw Error('invalid');return a;}
  try{
    const [toses,articles,docs]=await Promise.all([get('/data/toses.json'),get('/data/articles.json'),get('/data/documents.json')]);
    const published=x=>x&&x.status!=='draft';
    const rows=toses.filter(published);
    const stats=[['Карточек ТОС',rows.length,'Рабочая подборка портала'],['Городских ТОС',rows.filter(x=>x.type==='Городской').length,'По сведениям каталога'],['Сельских ТОС',rows.filter(x=>x.type==='Сельский').length,'По сведениям каталога'],['Статей',articles.filter(published).length,'Инструкции и рекомендации'],['Документов',docs.filter(published).length,'Шаблоны и справочные материалы']];
    root.innerHTML=stats.map(([label,value,hint])=>`<article class="stat-card"><b>${esc(value)}</b><span>${esc(label)}</span><em>${esc(hint)}</em></article>`).join('');
  }catch{/* Keep the published snapshot; absence of a response is not zero. */}
}
const homeStatsDetails=document.querySelector('#home-stats')?.closest('details');
homeStatsDetails?.addEventListener('toggle',()=>{if(homeStatsDetails.open&&!homeStatsDetails.dataset.statsRefreshed){homeStatsDetails.dataset.statsRefreshed='true';renderHomeStats();}});
