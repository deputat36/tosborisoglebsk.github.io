(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./tos-catalog-core.js'):root.TosCatalogCore,typeof module==='object'&&module.exports?require('./grants-core'):root.GrantsCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HomeDiscoveryCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(catalog,grantsCore){
  const allowedStatuses=['verified','partial','stale','needs_review'];
  function normalize(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,;:()]/g,' ').replace(/\s+/g,' ').trim();}
  function isPublished(item){return Boolean(item)&&item.status!=='draft';}
  function verificationStatus(item){return catalog.verificationStatus(item);}
  function searchToses(rows,query,limit=6){
    const q=normalize(query);if(q.length<2)return[];
    return(Array.isArray(rows)?rows:[]).filter(isPublished).map(item=>{
      const name=normalize(item.name);const location=normalize(item.location);
      const hay=normalize([item.name,item.location,item.boundaries,item.chairperson,item.description].join(' '));
      let rank=4;if(name===q)rank=0;else if(name.startsWith(q))rank=1;else if(location.startsWith(q))rank=2;else if(hay.includes(q))rank=3;
      return{item,rank,matches:hay.includes(q)};
    }).filter(entry=>entry.matches).sort((a,b)=>a.rank-b.rank||String(a.item.name||'').localeCompare(String(b.item.name||''),'ru')).slice(0,limit).map(entry=>entry.item);
  }
  function dayKey(value){const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return match?Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])):null;}
  function todayKey(now){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const d=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Date.UTC(Number(d.year),Number(d.month)-1,Number(d.day));}
  function buildCurrentOverview({events=[],news=[],grants=[],health={},now=new Date(),freshDays=30}={}){
    const current=todayKey(now);
    const upcoming=events.filter(isPublished).map(item=>({item,key:dayKey(item.date)})).filter(entry=>entry.key!==null&&entry.key>=current).sort((a,b)=>a.key-b.key||String(a.item.title||'').localeCompare(String(b.item.title||''),'ru')).slice(0,2).map(entry=>entry.item);
    const publishedNews=news.filter(item=>isPublished(item)&&item.content_origin!=='request').map(item=>({item,key:dayKey(item.date)})).filter(entry=>entry.key!==null&&entry.key<=current).sort((a,b)=>b.key-a.key || String(b.item.published_at || '').localeCompare(String(a.item.published_at || '')));
    const freshLimit=current-freshDays*86400000;
    return{opportunities:grantsCore?grantsCore.current(grants,new Date(now).getTime()).slice(0,2):[],upcoming,freshNews:publishedNews.filter(entry=>entry.key>=freshLimit).slice(0,2).map(entry=>entry.item),latestNews:publishedNews.length?publishedNews[0].item:null,generatedAt:health.generated_at||'',catalog:health.catalog||{},freshDays};
  }
  return{normalize,isPublished,verificationStatus,searchToses,dayKey,buildCurrentOverview};
});
