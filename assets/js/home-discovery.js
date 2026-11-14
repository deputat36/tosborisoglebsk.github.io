document.addEventListener('DOMContentLoaded',()=>{
  const core=window.HomeDiscoveryCore,view=window.HomeView;
  const root=document.querySelector('#home-tos-search-results');
  const input=document.querySelector('#home-tos-search');
  const controls=document.querySelector('[data-home-finder-controls]');
  if(!core||!view||!root||!input)return;
  let rows;
  try {rows=JSON.parse(document.querySelector('#home-directory-data').textContent);if(!Array.isArray(rows)||!rows.length)return;}catch{return;}
  const initial=root.innerHTML;
  function render(){
    const query=input.value.trim();
    if(!query){root.innerHTML=initial;return;}
    if(core.normalize(query).length<2){root.innerHTML='<p class="home-finder-empty">Введите минимум два символа.</p>';return;}
    const items=core.searchToses(rows,query,rows.length);
    root.innerHTML=items.length?items.map(view.row).join(''):'<div class="home-finder-empty"><b>Совпадений в опубликованном каталоге нет.</b><p>Попробуйте другое название или населённый пункт.</p><a href="/update-tos/?type=card#message-builder">Передать уточнение</a></div>';
  }
  controls.hidden=false;
  input.addEventListener('input',render);
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';render();}});
  document.querySelector('#home-tos-search-clear')?.addEventListener('click',()=>{input.value='';input.focus();render();});
  // Search is ready from the published page; optional updates never block it.
  async function get(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('unavailable');const a=await r.json();if(!Array.isArray(a))throw Error('invalid');return a;}finally{clearTimeout(timer);}}
  get('/data/toses.json').then(next=>{if(next.length){rows=next;render();}}).catch(()=>{});
  let currentData=null;
  function showCurrent(){if(currentData)document.querySelector('#home-current-overview').innerHTML=view.overview(core.buildCurrentOverview(currentData));}
  async function refreshCurrent(){
    try{const [events,news,grants]=await Promise.all([get('/data/events.json'),get('/data/news.json'),get('/data/grants.json')]);currentData={events,news,grants};showCurrent();}catch{/* Keep the dated public page readable. */}
  }
  refreshCurrent();
  setInterval(showCurrent,60000);
});
