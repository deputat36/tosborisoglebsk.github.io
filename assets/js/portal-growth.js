(() => {
  'use strict';
  const C=window.PortalGrowth, finder=document.querySelector('[data-task-finder]');
  if(C&&finder){
    const input=finder.querySelector('[data-task-query]'),role=finder.querySelector('[data-task-audience]'),status=finder.querySelector('[data-task-status]');
    const cards=[...finder.querySelectorAll('[data-task-card]')];
    const items=cards.map(node=>({node,title:node.querySelector('h3').textContent,description:node.querySelector('p').textContent,keywords:node.dataset.taskKeywords,audience:node.dataset.taskAudience.split(' ')}));
    function update(){let count=0;for(const item of items){const visible=C.matches(item,input.value,role.value);item.node.hidden=!visible;if(visible)count++;}status.textContent=count?'Подходящих задач: '+count+' из '+cards.length+'.':'Не нашли совпадение. Измените запрос или сбросьте фильтры. Все разделы остаются ниже.';finder.querySelector('[data-task-empty]').hidden=count!==0;}
    finder.querySelector('[data-task-controls]').hidden=false;
    input.addEventListener('input',update);role.addEventListener('change',update);
    finder.querySelector('[data-task-reset]').addEventListener('click',()=>{input.value='';role.value='';update();input.focus();});
    update();
  }
  for(const box of document.querySelectorAll('[data-share-portal]')){
    const status=box.querySelector('[data-share-status]'),message=box.querySelector('[data-share-message]').textContent.trim();
    for(const button of box.querySelectorAll('[data-share-copy]')){button.hidden=false;button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.shareCopy==='link'?'https://tosborisoglebsk.ru/':message);status.textContent='Скопировано. Выберите, кому и куда передать текст.';}catch{status.textContent='Копирование недоступно. Выделите и скопируйте текст приглашения выше.';}});}
    const share=box.querySelector('[data-share-native]');
    if(share&&typeof navigator.share==='function'){share.hidden=false;share.addEventListener('click',async()=>{try{await navigator.share({title:'ТОС БГО',text:'Найти свой ТОС, подготовить проект и воспользоваться инструкциями для жителей.',url:'https://tosborisoglebsk.ru/'});status.textContent='Меню передачи ссылки закрыто.';}catch(error){status.textContent=error.name==='AbortError'?'Передача отменена.':'Используйте копирование ссылки или приглашения.';}});}
  }
})();
