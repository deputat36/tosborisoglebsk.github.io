(function(){
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\' :'&#39;'}[c]));}
  function slugify(t){const m={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};return String(t||'').toLowerCase().split('').map(ch=>m[ch]??ch).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';}
  function downloadText(name,text,type='application/json;charset=utf-8'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function bulkFillLogo(){if(typeof state==='undefined'||state.section!=='toses')return;let changed=0;current().forEach(item=>{if(item.slug){const path='/assets/img/tos-logos/'+item.slug+'.svg';if(item.logo!==path){item.logo=path;changed++;}}});save();renderList();renderForm();msg([`Пути к логотипам обновлены для ${changed} записей.`],true);}
  function downloadNoLogoCSV(){if(typeof state==='undefined'||state.section!=='toses')return;const rows=current().filter(item=>!item.logo).map(item=>[item.name||'',item.slug||'',item.location||'',item.chairperson||'',`/assets/img/tos-logos/${item.slug||''}.svg`]);const header=['ТОС','slug','Территория','Председатель','Рекомендуемый путь логотипа'];const csv=[header,...rows].map(r=>r.map(esc).map(v=>'"'+v+'"').join(';')).join('\n');downloadText('tos-no-logo.csv','﻿'+csv,'text/csv;charset=utf-8');msg([`CSV сформирован. Записей без логотипа: ${rows.length}`],true);}
  ready(()=>{
    const row=document.querySelector('.tools-row');
    if(!row)return;
    row.insertAdjacentHTML('beforeend','<button class="btn" id="bulkLogoFill">Логотипы всем ТОСам</button><button class="btn" id="downloadNoLogo">CSV без логотипа</button>');
    document.querySelector('#bulkLogoFill')?.addEventListener('click',bulkFillLogo);
    document.querySelector('#downloadNoLogo')?.addEventListener('click',downloadNoLogoCSV);
  });
})();