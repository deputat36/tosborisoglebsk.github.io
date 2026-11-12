(() => {
 const root=document.querySelector('[data-portal-use-case]'),core=window.PortalUseCaseCore;if(!root||!core)return;
 const form=root.querySelector('form'),status=root.querySelector('[data-use-status]'),preview=root.querySelector('[data-use-preview]'),file=root.querySelector('[data-use-file]');
 const fields=[...root.querySelectorAll('[data-use-field]')],confirmed=root.querySelector('[data-use-confirmed]');let state=core.fresh();
 const say=text=>status.textContent=text;
 function read(){const next=core.fresh();for(const node of fields)next.fields[node.dataset.useField]=node.value;next.author_confirmed=confirmed.checked;state=core.normalize(next);preview.textContent=core.toText(state);return state;}
 function apply(next){state=core.normalize(next);for(const node of fields)node.value=state.fields[node.dataset.useField];confirmed.checked=state.author_confirmed;preview.textContent=core.toText(state);}
 function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 form.hidden=false;root.querySelector('[data-use-actions]').hidden=false;form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('input',()=>{try{read();say('Изменения пока на странице. Сохраните черновик или скачайте файл.');}catch(error){say(error.message);}});
 root.addEventListener('click',e=>{
  const button=e.target.closest('[data-use-action]');if(!button)return;
  try{
   const action=button.dataset.useAction;
   if(action==='save'){read();try{localStorage.setItem(core.KEY,JSON.stringify(state));say('Черновик сохранён на этом устройстве.');}catch{say('Сохранение в браузере недоступно. Скачайте файл, чтобы не потерять запись.');}}
   if(action==='open')file.click();
   if(action==='json'){read();download(JSON.stringify(state,null,2),'primenenie-portala-tos.json','application/json');say('Файл подготовлен на вашем устройстве. Запись на сайте не публикуется.');}
   if(action==='text'){read();download(core.toText(state),'primenenie-portala-tos.txt','text/plain;charset=utf-8');say('Текст подготовлен для самостоятельной проверки и передачи.');}
   if(action==='print'){read();document.body.classList.add('use-case-print');window.print();}
   if(action==='clear'&&confirm('Начать другую запись? Сначала скачайте текущую, если хотите её сохранить.')){apply(core.fresh());try{localStorage.removeItem(core.KEY);}catch{}say('Открыт пустой рабочий лист.');}
  }catch(error){say(error.message);}
 });
 file.addEventListener('change',async()=>{try{const item=file.files[0];if(!item)return;if(item.size>100000)throw Error('Файл должен быть не больше 100 КБ.');const next=core.normalize(JSON.parse(await item.text()));if(confirm('Открыть запись из файла вместо текущих полей?')){apply(next);say('Файл открыт на этом устройстве.');}}catch(error){say('Файл не открыт. '+error.message);}finally{file.value='';}});
 window.addEventListener('afterprint',()=>document.body.classList.remove('use-case-print'));
 try{const stored=localStorage.getItem(core.KEY);if(stored){apply(JSON.parse(stored));say('Открыт сохранённый на этом устройстве черновик.');}else{apply(state);say('Заполните один реальный случай применения.');}}catch{apply(state);say('Сохранённый черновик не прочитан. Он не заменяется автоматически; скачайте текущую запись перед закрытием.');}
})();
