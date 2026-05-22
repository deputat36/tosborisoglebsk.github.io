(function(){
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\' :'&#39;'}[c]));}
  function slugify(t){const m={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};return String(t||'').toLowerCase().split('').map(ch=>m[ch]??ch).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';}
  function readyAutofill(){
    const row=document.querySelector('.tools-row');
    if(!row)return;
    row.insertAdjacentHTML('beforeend','<button class="btn" id="autoFillAll">Автозаполнение всех ТОСов</button>');
    document.querySelector('#autoFillAll')?.addEventListener('click',()=>{
      if(typeof state==='undefined'||state.section!=='toses')return;
      current().forEach(item=>{
        if(item.name&&!item.slug)item.slug=slugify(item.name);
        if(!item.updated_at&&typeof today==='function')item.updated_at=today();
        if(item.slug&&!item.logo)item.logo='/assets/img/tos-logos/'+item.slug+'.svg';
      });
      save();
      renderList();
      renderForm();
      msg(['Автозаполнение применено ко всем ТОСам.'],true);
    });
  }
  ready(()=>{const wait=setInterval(()=>{if(typeof state==='undefined')return;clearInterval(wait);readyAutofill();},50);});
})();