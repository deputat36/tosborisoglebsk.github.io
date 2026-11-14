(() => {
  'use strict';
  const root=document.getElementById('contest-check');
  if(!root||!window.GrantsCore)return;
  const core=window.GrantsCore;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const choices=root.querySelector('[data-contest-choice]');
  const body=root.querySelector('[data-contest-items]');
  const stateNode=root.querySelector('[data-contest-state]');
  const count=root.querySelector('[data-contest-count]');
  const sources=root.querySelector('[data-contest-sources]');
  if(!choices||!body||!stateNode||!count||!sources)return;
  const checked=new Map();
  let active=null,opportunity=null;
  function report(){
    const done=[...body.querySelectorAll('input:checked')].length;
    count.textContent=`Отмечено ${done} из ${active.items.length}. Это ваша отметка комплектности; допуск и оценку определяет организатор.`;
  }
  function printCheck(){document.body.classList.add('contest-check-printing');window.print();}
  window.addEventListener('afterprint',()=>document.body.classList.remove('contest-check-printing'));
  Promise.all([fetch('/data/grants.json',{cache:'no-store'}),fetch('/data/contest_checklists.json',{cache:'no-store'})]).then(async responses=>{
    if(responses.some(response=>!response.ok))throw Error('unavailable');
    const [grants,data]=await Promise.all(responses.map(response=>response.json()));
    if(!Array.isArray(grants)||!Array.isArray(data.checklists)||!data.checklists.some(list=>list.id==='general'))throw Error('invalid');
    const items=grants.filter(item=>item.status!=='draft'&&['grant','award'].includes(item.opportunity_type));
    choices.innerHTML='<option value="">Общая подготовка проекта</option>'+items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('');
    function render(sync=true){
      opportunity=items.find(item=>item.id===choices.value)||null;
      active=data.checklists.find(list=>list.opportunities.includes(choices.value))||data.checklists.find(list=>list.id==='general');
      const prefix=opportunity?`${opportunity.title}. ${core.statusLabel(opportunity)}. ${opportunity.deadline}. `:'';
      stateNode.textContent=prefix+active.notice+(opportunity&&active.id==='general'?' Для этого отбора показан общий список; прочитайте все специальные требования в его документах.':'');
      body.innerHTML=active.items.map(item=>`<li><label><input type="checkbox" data-check-id="${esc(item.id)}"${checked.get(active.id+'|'+item.id)?' checked':''}/> <span>${esc(item.text)}</span></label><p class="tiny">${esc(item.locator)}${core.safeUrl(active.sources[item.source_index]?.url)?` · <a href="${esc(core.safeUrl(active.sources[item.source_index].url))}" target="_blank" rel="noopener noreferrer">Документ-основание</a>`:''} · <a href="${esc(item.tool)}">Рабочая форма</a></p></li>`).join('');
      const documents=opportunity?.source_documents?.length?opportunity.source_documents:active.sources;
      sources.innerHTML=documents.filter(doc=>core.safeUrl(doc.url)).map(doc=>`<li><a href="${esc(core.safeUrl(doc.url))}" target="_blank" rel="noopener noreferrer">${esc(doc.title)}</a>${doc.locator?' · '+esc(doc.locator):''}</li>`).join('');
      report();
      if(sync){const url=new URL(location.href);if(opportunity)url.searchParams.set('opportunity',opportunity.id);else url.searchParams.delete('opportunity');history.replaceState(null,'',url);}
    }
    function fromUrl(){const value=new URLSearchParams(location.search).get('opportunity');choices.value=items.some(item=>item.id===value)?value:'';render(false);}
    choices.addEventListener('change',()=>render());
    body.addEventListener('change',event=>{if(event.target.matches('[data-check-id]')){checked.set(active.id+'|'+event.target.dataset.checkId,event.target.checked);report();}});
    root.querySelector('[data-contest-reset]').addEventListener('click',()=>{for(const item of active.items)checked.delete(active.id+'|'+item.id);render(false);});
    root.querySelector('[data-contest-print]').addEventListener('click',printCheck);
    root.querySelector('[data-contest-download]').addEventListener('click',()=>{
      const lines=[opportunity?.title||active.title,new Date().toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}),stateNode.textContent,'',...active.items.map(item=>`${checked.get(active.id+'|'+item.id)?'[x]':'[ ]'} ${item.text}\n${item.locator}`),'','Официальные источники:',...Array.from(sources.querySelectorAll('a')).map(a=>a.textContent+' — '+a.href)];
      const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='tos-contest-check-'+active.id+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    window.addEventListener('popstate',fromUrl);
    fromUrl();root.querySelectorAll('[data-contest-controls]').forEach(node=>{node.hidden=false;});
  }).catch(()=>{count.textContent='Не удалось обновить перечень. Ниже сохранён общий список; специальные условия проверьте в документах организатора.';});
})();
