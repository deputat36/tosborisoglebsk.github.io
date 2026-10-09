(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TosMaterials=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(item){
    const url=item.url||'#';const target=/^https?:\/\//.test(url)?' target="_blank" rel="noopener"':'';
    const tags=Array.isArray(item.tags)&&item.tags.length?`<div class="card-actions">${item.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div>`:'';
    return `<article class="card"><div class="card-inner"><span class="tag">${esc(item.category)}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="tiny">Для кого: ${esc(item.audience)}</div>${tags}<div class="card-actions"><a class="btn primary" href="${esc(url)}"${target}>Открыть материал</a></div></div></article>`;
  }
  return {render};
});
