async function renderTosAudit(){
  const root=document.querySelector('#audit-root');
  if(!root)return;

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clean=v=>String(v||'').trim();
  const hasGoodDescription=t=>clean(t.description)&&clean(t.description)!=='Описание пока уточняется.';
  const isOld=t=>!t.updated_at||new Date(t.updated_at+'T00:00:00')<new Date('2026-05-23T00:00:00');
  const score=t=>{
    const checks=[t.name,t.location,t.boundaries,t.chairperson,(t.phones||[]).length,(t.emails||[]).length,(t.social_links||[]).length,t.logo,hasGoodDescription(t),t.population,t.founded];
    return Math.round(checks.filter(Boolean).length/checks.length*100);
  };
  const problems=t=>{
    const p=[];
    if(!(t.phones||[]).length)p.push('нет телефона');
    if(!(t.emails||[]).length)p.push('нет email');
    if(!(t.social_links||[]).length)p.push('нет соцсетей');
    if(!t.logo)p.push('нет логотипа');
    if(!hasGoodDescription(t))p.push('нет описания');
    if(!clean(t.boundaries))p.push('нет границ');
    if(!clean(t.population))p.push('нет населения');
    if(!clean(t.founded))p.push('нет года создания');
    if(isOld(t))p.push('давно не обновлялось');
    return p;
  };
  const issueFilter={
    phone:t=>!(t.phones||[]).length,
    email:t=>!(t.emails||[]).length,
    social:t=>!(t.social_links||[]).length,
    logo:t=>!t.logo,
    description:t=>!hasGoodDescription(t),
    boundaries:t=>!clean(t.boundaries),
    old:isOld
  };
  const ru={phone:'Без телефона',email:'Без email',social:'Без соцсетей',logo:'Без логотипа',description:'Без описания',boundaries:'Без границ',old:'Давно не обновлялись'};

  function stat(label,value){return `<div class="tile"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;}
  function row(t){
    const p=problems(t);
    const s=score(t);
    const cls=s>=80?'ok':s>=55?'warn':'bad';
    return `<article class="list-item audit-row"><div class="meta"><span class="tag ${cls}">${s}%</span><span class="tag">${esc(t.type||'Тип не указан')}</span><span class="tag">${esc(t.location||'Территория не указана')}</span>${p.map(x=>`<span class="tag warn">${esc(x)}</span>`).join('')}</div><h3>ТОС «${esc(t.name||'Без названия')}»</h3><p class="tiny"><b>Председатель:</b> ${esc(t.chairperson||'не указан')}<br><b>Обновлено:</b> ${esc(t.updated_at||'не указано')}<br><b>Контакты:</b> ${esc([...(t.phones||[]),...(t.emails||[])].join(', ')||'нет')}<br><b>Соцсети:</b> ${(t.social_links||[]).length?(t.social_links||[]).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join(', '):'нет'}</p><div class="card-actions"><a class="btn" href="/tos/${esc(t.slug)}/">Открыть карточку</a><a class="btn" href="/update-tos/">Запросить исправление</a></div></article>`;
  }
  function list(title,items,empty){
    return `<section class="section"><div class="container section-head"><div><h2>${esc(title)}</h2><p>Найдено: <b>${items.length}</b></p></div></div><div class="container list">${items.length?items.map(row).join(''):`<div class="empty">${esc(empty||'Проблем не найдено.')}</div>`}</div></section>`;
  }

  try{
    const data=(await fetch('/data/toses.json',{cache:'no-store'}).then(r=>r.ok?r.json():[])).filter(t=>t.status!=='draft');
    const sorted=[...data].sort((a,b)=>score(a)-score(b));
    const total=data.length;
    const avg=Math.round(data.reduce((sum,t)=>sum+score(t),0)/(total||1));
    const completed=data.filter(t=>score(t)>=80).length;
    const low=data.filter(t=>score(t)<55).length;
    const allProblems=data.reduce((sum,t)=>sum+problems(t).length,0);
    const locations=[...new Set(data.map(t=>t.location).filter(Boolean))];

    root.innerHTML=`<section class="section"><div class="container kpi">${stat('ТОСов в базе',total)}${stat('Средняя заполненность',avg+'%')}${stat('Хорошо заполнены',completed)}${stat('Требуют внимания',low)}${stat('Всего замечаний',allProblems)}${stat('Территорий',locations.length)}</div></section><section class="section"><div class="container notice">В первую очередь стоит запросить логотипы, недостающие телефоны, email, ссылки на сообщества и нормальные описания у карточек с низкой заполненностью.</div></section>${list('Сначала проблемные карточки',sorted.slice(0,12),'Все карточки заполнены хорошо.')}${Object.keys(issueFilter).map(key=>list(ru[key],data.filter(issueFilter[key]),'Нет таких карточек.')).join('')}`;
  }catch(e){
    root.innerHTML='<section class="section"><div class="container empty">Не удалось загрузить data/toses.json</div></section>';
  }
}
renderTosAudit();
