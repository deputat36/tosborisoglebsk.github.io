(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HomeDiscoveryCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const allowedStatuses=['verified','partial','stale','needs_review'];
  function normalize(value){return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,;:()]/g,' ').replace(/\s+/g,' ').trim();}
  function isPublished(item){return Boolean(item)&&item.status!=='draft';}
  function verificationStatus(item){return allowedStatuses.includes(item&&item.verification_status)?item.verification_status:'needs_review';}
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
  function todayKey(now){const date=now instanceof Date?now:new Date(now);return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());}
  function buildCurrentOverview({events=[],news=[],health={},now=new Date(),freshDays=30}={}){
    const current=todayKey(now);
    const upcoming=events.filter(isPublished).map(item=>({item,key:dayKey(item.date)})).filter(entry=>entry.key!==null&&entry.key>=current).sort((a,b)=>a.key-b.key||String(a.item.title||'').localeCompare(String(b.item.title||''),'ru')).slice(0,2).map(entry=>entry.item);
    const publishedNews=news.filter(item=>isPublished(item)&&item.content_origin!=='request').map(item=>({item,key:dayKey(item.date)})).filter(entry=>entry.key!==null&&entry.key<=current).sort((a,b)=>b.key-a.key);
    const freshLimit=current-freshDays*86400000;
    return{upcoming,freshNews:publishedNews.filter(entry=>entry.key>=freshLimit).slice(0,2).map(entry=>entry.item),latestNews:publishedNews.length?publishedNews[0].item:null,generatedAt:health.generated_at||'',catalog:health.catalog||{},freshDays};
  }
  return{normalize,isPublished,verificationStatus,searchToses,dayKey,buildCurrentOverview};
});
