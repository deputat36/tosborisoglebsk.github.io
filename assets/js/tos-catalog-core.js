(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TosCatalogCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const statuses=['verified','partial','stale','needs_review'];
  const sorts=['name','updated_desc','attention'];
  function normalize(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,;:()]/g,' ').replace(/\s+/g,' ').trim();}
  function verificationInfo(item, {now=Date.now()}={}) {
    const trust=item&&item.trust||{};
    const scope=Array.isArray(trust.verification_scope)?trust.verification_scope.filter(value=>typeof value==='string'&&value.trim()):[];
    const date=String(trust.checked_at||'');
    const source=String(trust.source_ref||'').trim();
    const stamp=checkedDay(date);
    const today=checkedDay(new Date(now).toISOString().slice(0,10));
    const ageDays=stamp===null?null:Math.floor((today-stamp)/86400000);
    const hasEvidence=Boolean(source&&scope.length&&stamp!==null&&stamp<=today);
    // A check of individual fields does not approve the whole card. Honour
    // only an explicit editorial status, backed by a source, date and scope.
    let status=hasEvidence&&statuses.includes(item&&item.verification_status)?item.verification_status:'needs_review';
    const recheckAfter=String(trust.recheck_after||'');
    const expiry=checkedDay(recheckAfter);
    if(status!=='needs_review'&&((expiry!==null&&expiry<today)||(expiry===null&&ageDays>180)))status='stale';
    const labels={verified:'Сведения подтверждены',partial:'Проверено частично',needs_review:'Требует проверки',stale:'Нужно перепроверить'};
    return {status,label:labels[status],date:stamp===null?'':date,source,scope,ageDays,age_days:ageDays,stale:status==='stale',recheckAfter,sourceType:trust.source_type||'',checkedBy:trust.checked_by||'',consentRef:trust.publication_consent_ref||'',note:item&&item.verification_note||''};
  }
  function checkedDay(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const stamp=Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null;
  }
  function verificationStatus(item,options){return verificationInfo(item,options).status;}
  function dateKey(value){const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return match?Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])):0;}
  function formatDateRu(value){const key=dateKey(value);if(!key)return'не указана';return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key));}
  function stateFromSearch(search=''){const params=new URLSearchParams(String(search).replace(/^\?/,''));const sort=params.get('sort');return{q:params.get('q')||'',location:params.get('location')||'',type:params.get('type')||'',trust:statuses.includes(params.get('trust'))?params.get('trust'):'',sort:sorts.includes(sort)?sort:'name'};}
  function stateToSearch(state={}){const params=new URLSearchParams();[['q',state.q],['location',state.location],['type',state.type],['trust',state.trust]].forEach(([key,value])=>{if(String(value||'').trim())params.set(key,String(value).trim());});if(state.sort&&state.sort!=='name')params.set('sort',state.sort);const query=params.toString();return query?`?${query}`:'';}
  function searchText(item,normalizedLocation=''){return normalize([item.name,item.location,normalizedLocation,item.boundaries,item.chairperson,item.description].join(' '));}
  function attentionRank(item){return({needs_review:0,stale:0,partial:1,verified:2})[verificationStatus(item)]??3;}
  function filterAndSort(rows,state={},locationFor=item=>item.location||''){const q=normalize(state.q);const items=(Array.isArray(rows)?rows:[]).filter(item=>item&&item.status!=='draft').filter(item=>{const location=locationFor(item);return(!q||searchText(item,location).includes(q))&&(!state.type||item.type===state.type)&&(!state.location||location===state.location)&&(!state.trust||verificationStatus(item)===state.trust);});return items.sort((a,b)=>{if(state.sort==='updated_desc')return dateKey(b.updated_at)-dateKey(a.updated_at)||String(a.name||'').localeCompare(String(b.name||''),'ru');if(state.sort==='attention')return attentionRank(a)-attentionRank(b)||dateKey(a.updated_at)-dateKey(b.updated_at)||String(a.name||'').localeCompare(String(b.name||''),'ru');return String(a.name||'').localeCompare(String(b.name||''),'ru');});}
  function activeFilterCount(state={}){return['q','location','type','trust'].filter(key=>String(state[key]||'').trim()).length+(state.sort&&state.sort!=='name'?1:0);}
  function resolutionState(items,state={}){const hasIdentityCriteria=Boolean(normalize(state.q)||String(state.location||'').trim());const count=Array.isArray(items)?items.length:0;if(!hasIdentityCriteria)return{kind:'start',count,hasIdentityCriteria};if(count===0)return{kind:'none',count,hasIdentityCriteria};if(count===1)return{kind:'single',count,hasIdentityCriteria};return{kind:'multiple',count,hasIdentityCriteria};}
  return{normalize,verificationStatus,verificationInfo,dateKey,formatDateRu,stateFromSearch,stateToSearch,searchText,attentionRank,filterAndSort,activeFilterCount,resolutionState};
});
