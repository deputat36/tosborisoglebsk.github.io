(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ContestReviewCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_BYTES=262144;
  const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const validId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,99}$/.test(value);
  function contexts(lists,opportunities){
    const general=lists.find(list=>list.id==='general');
    if(!general)throw Error('Общий список подготовки недоступен.');
    return [{scope:'general',list:general,opportunity:null},...opportunities.map(opportunity=>({
      scope:opportunity.id,opportunity,
      list:lists.find(list=>list.opportunities.includes(opportunity.id))||general
    }))];
  }
  function revision(context){
    const {list,opportunity}=context;
    return JSON.stringify({
      list:{id:list.id,notice:list.notice,items:list.items,sources:list.sources},
      opportunity:opportunity?{
        id:opportunity.id,season:opportunity.season,deadline:opportunity.deadline,
        deadline_at:opportunity.deadline_at,deadline_date:opportunity.deadline_date,
        eligibility:opportunity.eligibility,source:opportunity.source,
        source_documents:opportunity.source_documents
      }:null
    });
  }
  function snapshot(available,selected,checked,now=new Date()){
    return {kind:'tos-contest-review',version:1,saved_at:now.toISOString(),opportunity:selected||'',
      reviews:available.map(context=>({scope:context.scope,checklist:context.list.id,
        revision:revision(context),
        checked:context.list.items.filter(item=>checked.get(context.scope+'|'+item.id)===true).map(item=>item.id)
      }))};
  }
  function normalize(raw){
    if(!isObject(raw)||raw.kind!=='tos-contest-review'||raw.version!==1||
      typeof raw.opportunity!=='string'||(raw.opportunity!==''&&!validId(raw.opportunity))||
      typeof raw.saved_at!=='string'||raw.saved_at.length>64||
      !Array.isArray(raw.reviews)||raw.reviews.length>32)
      throw Error('Выберите файл проверки заявки, сохранённый на этой странице.');
    const seen=new Set();
    const reviews=raw.reviews.map(row=>{
      if(!isObject(row)||!validId(row.scope)||!validId(row.checklist)||seen.has(row.scope)||
        typeof row.revision!=='string'||row.revision.length>65536||
        !Array.isArray(row.checked)||row.checked.length>100||
        row.checked.some(id=>!validId(id))||new Set(row.checked).size!==row.checked.length)
        throw Error('В файле неподходящий или повторяющийся список проверки.');
      seen.add(row.scope);
      return {scope:row.scope,checklist:row.checklist,revision:row.revision,checked:row.checked.slice()};
    });
    return {kind:raw.kind,version:1,saved_at:raw.saved_at,opportunity:raw.opportunity,reviews};
  }
  function parse(text){
    if(typeof text!=='string'||text.length>MAX_BYTES)throw Error('Файл проверки должен быть не больше 256 КБ.');
    let raw;
    try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('Не удалось прочитать файл проверки. Выберите сохранённый JSON-файл.');}
    return normalize(raw);
  }
  function restore(raw,available){
    const saved=normalize(raw),checked=new Map(),changed=[],unknown=[];
    const byScope=new Map(available.map(context=>[context.scope,context]));
    for(const row of saved.reviews){
      const current=byScope.get(row.scope);
      if(!current){unknown.push(row.scope);continue;}
      if(row.checklist!==current.list.id||row.revision!==revision(current)){
        changed.push(current.opportunity?.title||current.list.title);continue;
      }
      const ids=new Set(current.list.items.map(item=>item.id));
      for(const id of row.checked){
        if(ids.has(id))checked.set(row.scope+'|'+id,true);
        else if(!unknown.includes(row.scope))unknown.push(row.scope);
      }
    }
    const opportunity=saved.opportunity&&byScope.has(saved.opportunity)?saved.opportunity:'';
    if(saved.opportunity&&!opportunity&&!unknown.includes(saved.opportunity))unknown.push(saved.opportunity);
    return {checked,opportunity,changed,unknown};
  }
  return {MAX_BYTES,contexts,revision,snapshot,normalize,parse,restore};
});
