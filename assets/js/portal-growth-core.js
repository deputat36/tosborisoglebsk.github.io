(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PortalGrowth=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const normalize=value=>String(value||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  function matches(item,query,audience){const haystack=normalize([item.title,item.description,item.keywords].join(' '));return (!audience||item.audience.includes(audience))&&normalize(query).split(' ').filter(Boolean).every(token=>haystack.includes(token));}
  return {normalize,matches};
});
