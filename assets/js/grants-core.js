(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GrantsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const APPLICANTS=Object.freeze({'tos-no-entity':'ТОС без юридического лица','tos-entity':'ТОС — юридическое лицо','nonprofit':'НКО','individual':'Житель / физическое лицо','entrepreneur':'ИП','municipal':'Муниципальная организация','commercial':'Коммерческая организация'});
  const THEMES=Object.freeze({landscaping:'Благоустройство и инфраструктура',social:'Социальная помощь',culture:'Культура и местная история',ecology:'Экология',sport:'Спорт и досуг',team:'Развитие ТОС и обучение'});
  const TYPES=Object.freeze({grant:'Финансирование проекта',award:'Признание сделанного',organization:'Организация поддержки',resource:'Партнёры и другие ресурсы',preparation:'Подготовка и обучение'});
  function safeUrl(value){try{const u=new URL(String(value));return u.protocol==='https:'?u.href:'';}catch{return '';}}
  function dayStamp(day){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return null;
    const stamp=Date.parse(day+'T00:00:00Z');
    return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===day?stamp:null;
  }
  function moscowDay(now){return new Date(Number(now)+3*3600000).toISOString().slice(0,10);}
  function deadline(item){
    if(!item)return null;
    if(item.deadline_precision==='none')return null;
    if(item.deadline_precision==='day'){
      const stamp=dayStamp(item.deadline_date);
      // Internal end-of-day boundary; never a claimed submission hour.
      return stamp===null?null:stamp+86400000-3*3600000-1;
    }
    const value=String(item.deadline_at||'');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
    const stamp=Date.parse(value);
    return Number.isFinite(stamp)&&dayStamp(value.slice(0,10))!==null?stamp:null;
  }
  function state(item,now=Date.now()){
    if(!item||item.status==='draft')return 'unconfirmed';
    if(item.call_status==='closed')return 'closed';
    const end=deadline(item);
    if(end===null)return 'unconfirmed';
    if(now>end)return 'closed';
    const checked=dayStamp(item.source_checked_at),today=dayStamp(moscowDay(now));
    return item.call_status==='announced'&&safeUrl(item.source)&&checked!==null&&checked<=today&&today-checked<=30*86400000?'announced':'unconfirmed';
  }
  function statusLabel(item,now){const phase=state(item,now);return phase==='closed'?'Срок подачи прошёл':phase==='announced'?'Приём по объявлению организатора':deadline(item)!==null?'Проверьте актуальное объявление':item.status||'Уточняется';}
  function current(items,now=Date.now()){return items.filter(item=>state(item,now)==='announced').sort((a,b)=>deadline(a)-deadline(b));}
  function group(item,now=Date.now()){
    const phase=state(item,now);
    if(phase==='announced')return 'current';
    if(phase==='closed'||/при[её]м.*заверш|срок.*про[шш]ёл|заверш[её]нн?ый сезон/i.test(item.status||''))return 'archive';
    if(item.opportunity_type==='preparation'||item.id==='application-preparation-calendar')return 'prepare';
    return 'support';
  }
  function normalize(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function eligibility(item,applicant){
    if(!applicant)return 'all';
    const rule=item.eligibility||{};
    if((rule.excluded_types||[]).includes(applicant))return 'excluded';
    if(!(rule.applicant_types||[]).length)return 'unknown';
    return rule.applicant_types.includes(applicant)?'possible':'excluded';
  }
  function matches(item,filters={},now=Date.now()){
    if(!item||item.status==='draft')return false;
    if(filters.view&&group(item,now)!==filters.view)return false;
    if(filters.type&&item.opportunity_type!==filters.type)return false;
    if(filters.applicant&&eligibility(item,filters.applicant)==='excluded')return false;
    if(filters.theme&&!(item.eligibility?.themes||[]).includes(filters.theme))return false;
    if(filters.geography){
      const areas=item.eligibility?.geography||[];
      if(areas.length&&!areas.includes('russia')&&!areas.includes(filters.geography)&&!(filters.geography==='bgo'&&areas.includes('voronezh')))return false;
    }
    const hay=normalize([item.title,item.who,item.best_for,item.category,item.note,item.operator,item.season,...(item.prepare||[])].join(' '));
    return normalize(filters.q).split(' ').filter(Boolean).every(word=>hay.includes(word));
  }
  return Object.freeze({APPLICANTS,THEMES,TYPES,safeUrl,dayStamp,moscowDay,deadline,state,statusLabel,current,group,normalize,eligibility,matches});
});
