(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectBudgetCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_ROWS=100, MAX_MONEY=1000000000000;
  const clean=(v,n=1000)=>String(v??'').slice(0,n).trim();
  function decimal(value,places){
    const text=clean(value,40).replace(/[\s\u00a0\u202f]/g,'').replace(/(?:₽|руб\.?)$/i,'').replace(',', '.');
    if(!text)return {empty:true,value:0};
    if(!new RegExp(`^\\d+(?:\\.\\d{0,${places}})?$`).test(text))return {error:'Введите неотрицательное число'};
    const [whole,fraction='']=text.split('.');
    const result=Number(whole)*10**places+Number(fraction.padEnd(places,'0'));
    return Number.isSafeInteger(result)&&result<=MAX_MONEY?{value:result}:{error:'Слишком большое значение'};
  }
  function fresh(){return {kind:'tos-project-budget',version:1,meta:{project:'',territory:'',date:'',responsible:''},expenses:['Материалы','Материалы','Оборудование','Работы','Доставка','Расходники','Другое'].map(category=>({category,item:'',quantity:'',price:'',source:''})),contributions:[{who:'',resource:'',value:''}],own:'',partners:'',notes:'Учтены доставка, крепёж и расходники; сохранены подтверждения цен; предусмотрено содержание результата.'};}
  function normalize(raw){
    if(!raw||raw.kind!=='tos-project-budget'||raw.version!==1||!Array.isArray(raw.expenses)||!Array.isArray(raw.contributions)||raw.expenses.length>MAX_ROWS||raw.contributions.length>MAX_ROWS)throw new Error('Выберите файл сметы этого инструмента, не более 100 строк в каждой таблице.');
    const result=fresh();
    Object.keys(result.meta).forEach(key=>result.meta[key]=clean(raw.meta?.[key],300));
    result.expenses=raw.expenses.map(row=>Object.fromEntries(['category','item','quantity','price','source'].map(key=>[key,clean(row?.[key])])));
    result.contributions=raw.contributions.map(row=>Object.fromEntries(['who','resource','value'].map(key=>[key,clean(row?.[key])])));
    ['own','partners','notes'].forEach(key=>result[key]=clean(raw[key],key==='notes'?5000:1000));
    return result;
  }
  function calculate(state){
    const errors=[],lineTotals=[];let cash=0,inkind=0;
    state.expenses.forEach((row,index)=>{
      const active=['item','quantity','price','source'].some(key=>clean(row[key]));
      const quantity=decimal(row.quantity,3), price=decimal(row.price,2);
      let total=0;
      if(active){
        if(!clean(row.item))errors.push({group:'expenses',index,field:'item',message:`Расход ${index+1}: укажите наименование.`});
        if(quantity.error||quantity.empty||quantity.value===0)errors.push({group:'expenses',index,field:'quantity',message:`Расход ${index+1}: укажите количество больше нуля, до трёх знаков после запятой.`});
        if(price.error||price.empty)errors.push({group:'expenses',index,field:'price',message:`Расход ${index+1}: укажите цену, до двух знаков после запятой.`});
        if(!quantity.error&&!price.error&&!quantity.empty&&!price.empty){total=Math.round(quantity.value*price.value/1000);if(!Number.isSafeInteger(total)||total>MAX_MONEY){errors.push({group:'expenses',index,field:'price',message:`Расход ${index+1}: сумма слишком велика.`});total=0;}}
      }
      lineTotals.push(total);cash+=total;
    });
    state.contributions.forEach((row,index)=>{const value=decimal(row.value,2);if(value.error)errors.push({group:'contributions',index,field:'value',message:`Вклад ${index+1}: проверьте оценочную стоимость.`});else inkind+=value.value;});
    const funding={};
    ['own','partners'].forEach(key=>{const value=decimal(state[key],2);if(value.error)errors.push({group:'funding',field:key,message:'Проверьте денежный вклад: нужно неотрицательное число с точностью до копейки.'});funding[key]=value.error?0:value.value;});
    if(cash+inkind>MAX_MONEY)errors.push({group:'total',message:'Общая стоимость превышает допустимый диапазон расчёта.'});
    const balance=cash-funding.own-funding.partners;
    return {cash,inkind,total:cash+inkind,request:Math.max(0,balance),excess:Math.max(0,-balance),lineTotals,errors,valid:errors.length===0};
  }
  const money=value=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2}).format(value/100);
  const csvMoney=value=>(value/100).toFixed(2).replace('.',',');
  const csvCell=value=>{let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  function toText(state){const sums=calculate(state);return ['СМЕТА ПРОЕКТА ТОС',...Object.entries({Проект:state.meta.project,'ТОС / территория':state.meta.territory,Дата:state.meta.date,Ответственный:state.meta.responsible}).map(([k,v])=>`${k}: ${v}`),'',...state.expenses.map((row,i)=>`${i+1}. ${row.category}; ${row.item}; ${row.quantity} × ${row.price} ₽ = ${money(sums.lineTotals[i])}; источник: ${row.source}`),'',`Денежные расходы: ${money(sums.cash)}`,`Неденежный вклад: ${money(sums.inkind)}`,`Общая стоимость: ${money(sums.total)}`,`Собственные деньги: ${state.own||0} ₽`,`Деньги партнёров: ${state.partners||0} ₽`,`Требуется финансирование: ${money(sums.request)}`,...state.contributions.filter(x=>x.who||x.resource||x.value).map(x=>`Вклад: ${x.who}; ${x.resource}; ${x.value||0} ₽`),'',state.notes,...(sums.valid?[]:['ВНИМАНИЕ: есть ошибки, итоги неполные.'])].join('\n');}
  function toCsv(state){const sums=calculate(state);if(!sums.valid)throw new Error('Исправьте числовые значения перед выгрузкой итогов.');const rows=[['СМЕТА ПРОЕКТА ТОС',state.meta.project],['ТОС / территория',state.meta.territory],['Дата',state.meta.date],['Ответственный',state.meta.responsible],[],['№','Раздел','Наименование','Количество','Цена, ₽','Сумма, ₽','Источник цены'],...state.expenses.map((row,i)=>[i+1,row.category,row.item,row.quantity.replace('.',','),row.price ? csvMoney(decimal(row.price,2).value) : '',csvMoney(sums.lineTotals[i]),row.source]),[],['Неденежный вклад'],['Участник','Ресурс / работа','Оценочная стоимость, ₽'],...state.contributions.map(row=>[row.who,row.resource,row.value ? csvMoney(decimal(row.value,2).value) : '']),[],['Денежные расходы, ₽',csvMoney(sums.cash)],['Неденежный вклад, ₽',csvMoney(sums.inkind)],['Общая стоимость, ₽',csvMoney(sums.total)],['Собственные деньги, ₽',csvMoney(decimal(state.own,2).value)],['Деньги партнёров, ₽',csvMoney(decimal(state.partners,2).value)],['Требуется финансирование, ₽',csvMoney(sums.request)],[],['Примечания',state.notes]];return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');}
  return {MAX_ROWS,fresh,normalize,decimal,calculate,money,toText,toCsv};
});
