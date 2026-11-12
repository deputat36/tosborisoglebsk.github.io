(() => {
  'use strict';
  const root=document.querySelector('[data-project-packet]');
  const api=window.ProjectWorkspace,core=window.ProjectWorkspaceCore,budgetCore=window.ProjectBudgetCore;
  if(!root||!api||!core)return;
  const frame=root.querySelector('[data-packet-preview]'),prepare=root.querySelector('[data-packet-prepare]'),print=root.querySelector('[data-packet-print]'),status=root.querySelector('[data-packet-status]');
  let preparedSignature='',preparedSelection='',loaded=false;
  root.hidden=false;
  const selection=()=>[...root.querySelectorAll('[data-packet-document]:checked')].map(x=>x.value).filter(x=>core.FORMS.includes(x));
  const make=(doc,tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  function budgetPaper(doc,state){
    const article=make(doc,'article');article.className='template-paper';article.append(make(doc,'h1','СМЕТА ПРОЕКТА ТОС'));
    for(const [key,label] of [['project','Проект'],['territory','ТОС / территория'],['responsible','Ответственный']])article.append(make(doc,'p',label+': '+(state.common[key]||'')));
    const values=core.budgetValues(state);
    if(!values){
      if(state.budget&&!budgetCore.calculate(state.budget).valid)throw Error('В смете есть ошибки. Откройте расчёт и исправьте их перед сборкой комплекта.');
      article.append(make(doc,'p','Смета ещё не заполнена. Плановые суммы не указаны.'));return article;
    }
    const table=make(doc,'table');table.className='template-table';const head=make(doc,'tr');for(const title of ['Расход','Количество','Цена','Сумма'])head.append(make(doc,'th',title));table.append(head);
    const sums=budgetCore.calculate(state.budget);
    state.budget.expenses.forEach((row,i)=>{if(![row.item,row.quantity,row.price,row.source].some(Boolean))return;const tr=make(doc,'tr');for(const value of [row.item,row.quantity,row.price,budgetCore.money(sums.lineTotals[i])])tr.append(make(doc,'td',value));table.append(tr);if(row.source){const tr=make(doc,'tr'),td=make(doc,'td','Источник цены: '+row.source);td.colSpan=4;tr.append(td);table.append(tr);}});
    article.append(table);
    for(const [key,label] of [['cash','Денежные расходы'],['own','Собственные деньги'],['partners','Деньги партнёров'],['request','Требуется финансирование'],['inkind','Неденежный вклад'],['total','Общая оценочная стоимость']])article.append(make(doc,'p',label+': '+values[key]));
    for(const row of state.budget.contributions.filter(x=>x.who||x.resource||x.value))article.append(make(doc,'p','Неденежный вклад: '+[row.who,row.resource,row.value?row.value+' ₽':''].filter(Boolean).join('; ')));
    article.append(make(doc,'p','Все суммы в этом документе плановые. Неденежный вклад учитывается отдельно от требуемого финансирования.'));return article;
  }
  async function paper(form,state){
    if(form==='budget')return {form,budget:true};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/documents/templates/project-'+form+'/',{signal:controller.signal});
      if(!response.ok||new URL(response.url).origin!==location.origin)throw Error('Не удалось открыть документ.');
      const source=new DOMParser().parseFromString(await response.text(),'text/html');
      const article=source.querySelector('.template-paper');if(!article)throw Error('Не найден печатный бланк.');
      article.querySelectorAll('script,iframe,object,embed,form').forEach(x=>x.remove());
      for(const node of article.querySelectorAll('*'))for(const attr of [...node.attributes])if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
      for(const node of article.querySelectorAll('[data-project-field]')){
        const meta={key:node.dataset.projectField,common:node.dataset.projectCommon,derived:node.dataset.projectDerived,budget:node.dataset.projectBudget,default:node.textContent};
        const value=core.fieldValue(state,form,meta);
        const explicit=meta.common&&Object.hasOwn(state.common,meta.common)||Object.hasOwn(state.documents[form]||{},meta.key);
        if(node.type==='checkbox'){node.checked=value==='1';if(node.checked)node.setAttribute('checked','');else node.removeAttribute('checked');node.disabled=true;}
        else {node.textContent=value;node.removeAttribute('contenteditable');node.removeAttribute('role');node.removeAttribute('aria-multiline');if(!explicit&&value===meta.default&&value)node.classList.add('field-hint');}
      }
      const totals=core.budgetValues(state);
      article.querySelectorAll('[data-project-budget-value]').forEach(node=>{node.textContent=totals?totals[node.dataset.projectBudgetValue]:'не указано';});
      article.removeAttribute('id');
      article.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
      return {form,article};
    }finally{clearTimeout(timer);}
  }
  prepare.addEventListener('click',async()=>{
    const selected=selection();if(!selected.length){status.textContent='Выберите хотя бы один документ.';return;}
    const state=api.snapshot(),signature=core.signature(state);prepare.disabled=true;print.hidden=true;loaded=false;status.textContent='Собираем выбранные документы…';
    try{
      const results=await Promise.allSettled(selected.map(form=>paper(form,state)));
      const failed=results.find(x=>x.status==='rejected');if(failed)throw failed.reason;
      if(signature!==core.signature(api.snapshot())||selected.join()!==selection().join())throw Error('Данные или состав комплекта изменились. Соберите комплект ещё раз.');
      const doc=document.implementation.createHTMLDocument('Комплект документов проекта ТОС');doc.documentElement.lang='ru';
      const meta=make(doc,'meta');meta.setAttribute('charset','utf-8');doc.head.append(meta);
      const viewport=make(doc,'meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';doc.head.append(viewport);
      const style=make(doc,'style');style.textContent='@page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;padding:20px;color:#222;background:#fff;font:15px/1.5 Arial,sans-serif}h1{font-size:24px;line-height:1.25}h2{font-size:18px}p{margin:10px 0}.template-paper,.packet-cover{max-width:900px;margin:0 auto 30px;break-after:page;page-break-after:always}.template-paper:last-child{break-after:auto;page-break-after:auto}.field{white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.5em;border-bottom:1px dotted #aaa}.field.block{display:block;min-height:60px}.field-hint{color:#666;font-style:italic}.template-table{width:100%;border-collapse:collapse;table-layout:fixed}.template-table td,.template-table th{padding:7px;border:1px solid #aaa;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}tr{break-inside:avoid}th{text-align:left;background:#eee}.signature-grid{display:flex;gap:30px}.muted{color:#666}@media screen and (max-width:620px){body{padding:12px;font-size:14px}.project-mobile-table,.project-mobile-table tbody{display:block}.project-mobile-table tr:not(.project-table-head){display:block;margin:14px 0;border:1px solid #aaa}.project-mobile-table td{display:block;border:0;padding:7px}.project-mobile-table td:before{content:attr(data-label);display:block;font-size:12px;font-weight:bold}.project-mobile-table .project-table-head{display:none}}@media print{body{padding:0;font-size:11pt}.field-hint{color:#555}}';doc.head.append(style);
      const cover=make(doc,'section');cover.className='packet-cover';cover.append(make(doc,'p','ПОРТАЛ ТОС БГО'),make(doc,'h1',state.common.project||'Комплект документов проекта'),make(doc,'p','Территория: '+(state.common.territory||'не указана')),make(doc,'p','Рабочий черновик. Перед использованием проверьте факты, подписи и требования получателя.'));
      const missing=core.draftChecks(state).filter(x=>!x.ready);if(missing.length)cover.append(make(doc,'p','Основные сведения, которые ещё нужно добавить: '+missing.map(x=>x.label).join(', ')+'.'));
      const ul=make(doc,'ul');for(const form of selected){const checkbox=root.querySelector('[data-packet-document][value="'+form+'"]');ul.append(make(doc,'li',checkbox.closest('label').textContent.trim()));}cover.append(ul);
      if(selected.includes('support'))cover.append(make(doc,'p','Лист поддержки может содержать личные сведения и подписи. Заполненный комплект не предназначен для открытой публикации.'));
      doc.body.append(cover);
      for(const result of results){const item=result.value;doc.body.append(item.budget?budgetPaper(doc,state):doc.importNode(item.article,true));}
      preparedSignature=signature;preparedSelection=selected.join();
      frame.onload=()=>{loaded=true;print.hidden=false;status.textContent='Комплект собран на этом устройстве. Проверьте документы в просмотре перед печатью.';};
      frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;frame.hidden=false;
    }catch(error){status.textContent=error.name==='AbortError'?'Загрузка заняла слишком много времени. Попробуйте собрать комплект ещё раз.':error.message;}
    finally{prepare.disabled=false;}
  });
  print.addEventListener('click',()=>{
    if(!loaded||preparedSignature!==core.signature(api.snapshot())||preparedSelection!==selection().join()){print.hidden=true;status.textContent='Сведения изменились. Соберите комплект ещё раз.';return;}
    try{frame.contentWindow.focus();frame.contentWindow.print();}catch{status.textContent='Печать недоступна в этом браузере. Используйте печать отдельных форм.';}
  });
  const invalidate=()=>{if(loaded){print.hidden=true;status.textContent='Сведения изменились. Соберите комплект ещё раз перед печатью.';}};
  root.addEventListener('change',invalidate);window.addEventListener('project-workspace-change',invalidate);
})();
