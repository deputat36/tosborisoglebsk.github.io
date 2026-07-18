(function(){
  const core=window.ResidentRouteCore;
  const root=document.querySelector('#resident-route-navigator');
  if(!core||!root)return;
  const options=root.querySelector('[data-route-options]');
  const result=root.querySelector('[data-route-result]');
  const copyButton=root.querySelector('[data-route-copy]');
  const resetButton=root.querySelector('[data-route-reset]');
  const status=root.querySelector('[data-route-status]');
  let current='';
  const esc=value=>String(value||'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  options.innerHTML=core.listRoutes().map(route=>`<button class="route-choice" type="button" data-route-code="${esc(route.code)}" aria-pressed="false"><span class="tag ${esc(route.tone)}">${esc(route.owner)}</span><b>${esc(route.label)}</b><span>Получить маршрут и список сведений</span></button>`).join('');
  function show(code){
    const route=core.getRoute(code);if(!route)return;
    current=code;
    options.querySelectorAll('[data-route-code]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.routeCode===code)));
    const actions=route.actions.length?`<div class="card-actions">${route.actions.map(([label,href],index)=>`<a class="btn ${index===0?'primary':''}" href="${esc(href)}">${esc(label)}</a>`).join('')}</div>`:'<p class="notice"><b>Важно:</b> портал и ТОС не являются каналом быстрого реагирования.</p>';
    result.innerHTML=`<div class="route-result-head"><span class="tag ${esc(route.tone)}">Рекомендуемый маршрут</span><h3>${esc(route.owner)}</h3><p>${esc(route.summary)}</p></div><div class="route-checklist"><h4>Что подготовить</h4><ul>${route.collect.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>${actions}`;
    result.hidden=false;copyButton.hidden=false;resetButton.hidden=false;status.textContent=`Выбран маршрут: ${route.owner}`;result.focus();
  }
  options.addEventListener('click',event=>{const button=event.target.closest('[data-route-code]');if(button)show(button.dataset.routeCode);});
  resetButton.addEventListener('click',()=>{current='';result.hidden=true;copyButton.hidden=true;resetButton.hidden=true;options.querySelectorAll('[data-route-code]').forEach(button=>button.setAttribute('aria-pressed','false'));status.textContent='Выбор сброшен';options.querySelector('[data-route-code]')?.focus();});
  copyButton.addEventListener('click',async()=>{if(!current)return;const text=core.buildMessage(current);try{await navigator.clipboard.writeText(text);status.textContent='Шаблон скопирован';copyButton.textContent='Скопировано';setTimeout(()=>copyButton.textContent='Скопировать шаблон',1800);}catch{status.textContent='Не удалось скопировать автоматически. Используйте список на экране.';}});
})();