(() => {
  'use strict';
  const core=window.ProjectBudgetCore,root=document.querySelector('[data-project-budget]');
  if(!root||!core)return;
  const key='tos-project-budget-v1',status=root.querySelector('#budget-save-status'),errorsRoot=root.querySelector('#budget-errors');
  let state=core.fresh(),timer,undo=null,storageAvailable=true;
  const say=text=>{if(status.textContent!==text)status.textContent=text;};
  try{const saved=localStorage.getItem(key);if(saved){state=core.normalize(JSON.parse(saved));say('Черновик восстановлен из этого браузера.');}}catch{storageAvailable=false;say('Не удалось восстановить черновик. Скачивайте файл сметы для сохранения.');}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));storageAvailable=true;say('Черновик сохранён в этом браузере.');return true;}catch{storageAvailable=false;say('Автосохранение недоступно. Скачайте файл сметы.');return false;}}
  const cell=(tr,label)=>{const td=document.createElement('td');td.dataset.label=label;tr.append(td);return td;};
  function control(parent,group,index,field,value,label,numeric=false){const input=document.createElement(numeric?'input':'textarea');if(numeric)input.type='text';else input.rows=2;input.value=value;input.className='budget-input';input.dataset.group=group;input.dataset.field=field;if(index!==null)input.dataset.index=index;input.setAttribute('aria-label',label);input.maxLength=numeric?40:1000;if(numeric)input.inputMode='decimal';parent.append(input);return input;}
  function resizeText(el){if(el.tagName==='TEXTAREA'){el.style.height='auto';el.style.height=`${Math.max(42,el.scrollHeight)}px`;}}
  function removeButton(parent,group,index){const b=document.createElement('button');b.type='button';b.className='btn budget-remove';b.textContent='Удалить';b.setAttribute('aria-label',`Удалить ${group==='expenses'?'расход':'вклад'} ${index+1}`);b.dataset.remove=group;b.dataset.index=index;parent.append(b);}
  function render(){
    for(const group of ['expenses','contributions']){
      const body=root.querySelector(`[data-budget-rows="${group}"]`);body.replaceChildren();
      state[group].forEach((row,index)=>{const tr=document.createElement('tr');tr.dataset.budgetRow=group;tr.dataset.index=index;body.append(tr);
        if(group==='expenses'){
          const number=cell(tr,'Строка');number.append(document.createTextNode(String(index+1)));removeButton(number,group,index);
          [['category','Раздел'],['item','Наименование'],['quantity','Количество'],['price','Цена, ₽']].forEach(([field,label])=>control(cell(tr,label),group,index,field,row[field],`Расход ${index+1}. ${label}`,['quantity','price'].includes(field)));
          const total=cell(tr,'Сумма');total.dataset.lineTotal=index;
          control(cell(tr,'Источник и дата цены'),group,index,'source',row.source,`Расход ${index+1}. Источник и дата цены`);
        }else{[['who','Участник'],['resource','Ресурс / работа'],['value','Оценочная стоимость, ₽']].forEach(([field,label])=>control(cell(tr,label),group,index,field,row[field],`Вклад ${index+1}. ${label}`,field==='value'));removeButton(cell(tr,'Действие'),group,index);}
      });
    }
    root.querySelectorAll('[data-meta]').forEach(el=>el.value=state.meta[el.dataset.meta]);
    root.querySelectorAll('[data-funding]').forEach(el=>el.value=state[el.dataset.funding]);
    root.querySelector('#budget-notes').value=state.notes;
    root.querySelectorAll('textarea').forEach(resizeText);
    update();
  }
  function update(){
    const totals=core.calculate(state);
    root.querySelectorAll('[data-line-total]').forEach(el=>el.textContent=core.money(totals.lineTotals[Number(el.dataset.lineTotal)]));
    root.querySelectorAll('[data-budget-total]').forEach(el=>el.textContent=core.money(totals[el.dataset.budgetTotal]));
    root.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
    errorsRoot.replaceChildren();
    totals.errors.forEach(error=>{const p=document.createElement('p');p.textContent=error.message;errorsRoot.append(p);const selector=error.group==='funding'?`[data-funding="${error.field}"]`:`[data-group="${error.group}"][data-index="${error.index}"][data-field="${error.field}"]`;root.querySelector(selector)?.setAttribute('aria-invalid','true');});
    errorsRoot.hidden=totals.valid;
    root.querySelector('#budget-summary-status').textContent=!totals.valid?'Есть ошибки: итоги неполные.':totals.excess?`Денежный вклад превышает расходы на ${core.money(totals.excess)}. Проверьте источники финансирования.`:'Суммы рассчитаны. Цены и условия финансирования проверьте перед подачей.';
    root.querySelector('[data-download="csv"]').disabled=!totals.valid;
    root.querySelector('#budget-undo').hidden=!undo;
  }
  root.addEventListener('input',event=>{const el=event.target;if(el.dataset.group)state[el.dataset.group][Number(el.dataset.index)][el.dataset.field]=el.value;else if(el.dataset.meta)state.meta[el.dataset.meta]=el.value;else if(el.dataset.funding)state[el.dataset.funding]=el.value;else if(el.id==='budget-notes')state.notes=el.value;else return;resizeText(el);update();clearTimeout(timer);timer=setTimeout(save,350);});
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  root.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.add){const group=b.dataset.add;if(state[group].length>=core.MAX_ROWS){say('Можно добавить не более 100 строк в таблицу.');return;}state[group].push(group==='expenses'?{category:'Другое',item:'',quantity:'',price:'',source:''}:{who:'',resource:'',value:''});render();save();root.querySelector(`[data-group="${group}"][data-index="${state[group].length-1}"]`)?.focus();}
    if(b.dataset.remove){undo=JSON.parse(JSON.stringify(state));state[b.dataset.remove].splice(Number(b.dataset.index),1);render();save();root.querySelector(`[data-add="${b.dataset.remove}"]`)?.focus();}
    if(b.id==='budget-undo'&&undo){state=undo;undo=null;render();save();}
    if(b.id==='budget-clear'&&confirm('Очистить текущую смету? После очистки можно отменить это действие или открыть скачанный файл.')){undo=JSON.parse(JSON.stringify(state));state=core.fresh();render();save();}
    if(b.dataset.download){clearTimeout(timer);save();try{const csv=b.dataset.download==='csv';download(csv?core.toCsv(state):JSON.stringify(state,null,2),`smeta-tos-${new Date().toISOString().slice(0,10)}.${csv?'csv':'json'}`,csv?'text/csv;charset=utf-8':'application/json');}catch(error){say(error.message);}}
    if(b.id==='budget-import')root.querySelector('#budget-file').click();
  });
  root.querySelector('#budget-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1048576)throw new Error('Файл слишком большой: допустимо до 1 МБ.');const next=core.normalize(JSON.parse(await file.text()));undo=JSON.parse(JSON.stringify(state));state=next;render();say(save()?'Файл сметы открыт. Данные сохранены в этом браузере.':'Файл сметы открыт. Автосохранение недоступно; скачайте файл сметы перед закрытием.');}catch(error){say(`Не удалось открыть файл. ${error.message}`);}event.target.value='';});
  root.querySelector('[data-print-template]').addEventListener('click',event=>{if(!core.calculate(state).valid){event.stopImmediatePropagation();say('Исправьте ошибки в числах перед печатью.');root.querySelector('[aria-invalid="true"]')?.focus();}},true);
  root.querySelector('[data-copy-template]').addEventListener('click',async event=>{event.stopImmediatePropagation();try{await navigator.clipboard.writeText(core.toText(state));say('Текст сметы скопирован со значениями полей.');}catch{say('Копирование недоступно. Скачайте CSV или файл сметы.');}},true);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);save();});
  render();if(!status.textContent)say(storageAvailable?'Смета сохраняется только в этом браузере. Для переноса скачайте файл.':'Скачайте файл сметы, чтобы сохранить работу.');
})();
