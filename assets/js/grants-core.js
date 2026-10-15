(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GrantsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function deadline(item){
    const value=String(item.deadline_at||'');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
    const day=value.slice(0,10), stamp=Date.parse(value), dayStamp=Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(stamp)&&Number.isFinite(dayStamp)&&new Date(dayStamp).toISOString().slice(0,10)===day?stamp:null;
  }
  function state(item,now=Date.now()){
    if(!item||item.status==='draft')return 'unconfirmed';
    const end=deadline(item);
    if(end===null)return 'unconfirmed';
    if(now>end)return 'closed';
    const day=String(item.source_checked_at||'');
    const checked=/^\d{4}-\d{2}-\d{2}$/.test(day)?Date.parse(`${day}T00:00:00Z`):NaN;
    const today=Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z');
    let source=false;try{source=new URL(item.source).protocol==='https:';}catch{}
    return item.call_status==='announced'&&source&&Number.isFinite(checked)&&new Date(checked).toISOString().slice(0,10)===day&&checked<=today&&today-checked<=30*86400000?'announced':'unconfirmed';
  }
  function statusLabel(item,now){const phase=state(item,now);return phase==='closed'?'Срок подачи прошёл':phase==='announced'?'Приём по объявлению организатора':item.deadline_at?'Проверьте актуальное объявление':item.status||'Уточняется';}
  function current(items,now=Date.now()){return items.filter(item=>state(item,now)==='announced').sort((a,b)=>deadline(a)-deadline(b));}
  return {deadline,state,statusLabel,current};
});
