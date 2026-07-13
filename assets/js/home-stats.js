async function renderHomeStats(){
  const root=document.querySelector('#home-stats');
  if(!root)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num=v=>{
    const n=String(v??'').replace(/[^\d]/g,'');
    return n?Number(n):0;
  };
  async function get(url){
    try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():[]}catch{return[]}
  }
  const [toses,news,projects,events,needs,articles,docs]=await Promise.all([
    get('/data/toses.json'),get('/data/news.json'),get('/data/projects.json'),get('/data/events.json'),get('/data/needs.json'),get('/data/articles.json'),get('/data/documents.json')
  ]);
  const published=x=>x.status!=='draft';
  const pt=toses.filter(published);
  const city=pt.filter(t=>t.type==='Городской').length;
  const village=pt.filter(t=>t.type==='Сельский').length;
  const population=pt.reduce((sum,t)=>sum+num(t.population),0);
  const linkedProjects=projects.filter(p=>published(p)&&p.tos_slug).length;
  const linkedEvents=events.filter(e=>published(e)&&e.tos_slug).length;
  const stats=[
    ['ТОСов в каталоге',pt.length,'Карточки с контактами, границами и описанием'],
    ['Городских ТОС',city,'Дворы, улицы и микрорайоны Борисоглебска'],
    ['Сельских ТОС',village,'Сёла и посёлки Борисоглебского округа'],
    ['Жителей охвачено',population?population.toLocaleString('ru-RU'):'уточняется','По данным анкет ТОСов'],
    ['Новостей',news.filter(published).length,'Публикации, конкурсы и важные обновления'],
    ['Проектов и идей',projects.filter(published).length,'Банк идей для заявок и благоустройства'],
    ['Событий',events.filter(published).length,'Календарь собраний, субботников и сроков'],
    ['Потребностей',needs.filter(published).length,'Где ТОСам нужна помощь'],
    ['Материалов',articles.filter(published).length,'Инструкции, чек-листы и рекомендации'],
    ['Документов',docs.filter(published).length,'Шаблоны и правовая база'],
    ['Проектов с ТОС',linkedProjects,'Привязаны к конкретным территориям'],
    ['Событий с ТОС',linkedEvents,'Отображаются на страницах ТОСов']
  ];
  root.innerHTML=stats.map(([label,value,hint])=>`<article class="stat-card"><b>${esc(value)}</b><span>${esc(label)}</span><em>${esc(hint)}</em></article>`).join('');
}
renderHomeStats();
