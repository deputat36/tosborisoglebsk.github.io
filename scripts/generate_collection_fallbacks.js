const fs=require('fs'),vm=require('vm'),path=require('path');
const materials=require('../assets/js/materials-core');
const core=require('../assets/js/collection-browser-core');
const newsMedia=require('../assets/js/news-media');
function replaceMount(file,id,content){
 let html=fs.readFileSync(file,'utf8');
 const begin=`<!-- collection:${id}:start -->`,end=`<!-- collection:${id}:end -->`;
 if(html.includes(begin)){html=html.replace(new RegExp(begin+'[\\s\\S]*?'+end),begin+content+end);}
 else{const pattern=new RegExp(`(<div class="container (?:list|grid|tos-summary)" id="${id}">)<div class="empty">[^<]*</div>`);if(!pattern.test(html))throw new Error('Missing fallback mount '+id);html=html.replace(pattern,(_,open)=>open+begin+content+end);}
 fs.writeFileSync(file,html);
}
function main(){
 const materialItems=materials.buildCatalog(JSON.parse(fs.readFileSync('data/materials.json')),JSON.parse(fs.readFileSync('data/articles.json')));
 replaceMount('materials/index.html','articles-list',materialItems.map(materials.render).join(''));
 let html=fs.readFileSync('materials/index.html','utf8').replace('class="container list" id="articles-list"','class="container grid" id="articles-list"');
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const available=new Set(materialItems.map(item=>item.topic));
 const options='<option value="">Все темы</option>'+Object.entries(materials.TOPICS).filter(([id])=>available.has(id)).map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
 html=html.replace(/<!-- materials:topics:start -->[\s\S]*?<!-- materials:topics:end -->/,'<!-- materials:topics:start -->'+options+'<!-- materials:topics:end -->');
 html=html.replace(/<!-- materials:count:start -->[\s\S]*?<!-- materials:count:end -->/,'<!-- materials:count:start -->Показано: '+materialItems.length+' из '+materialItems.length+'.<!-- materials:count:end -->');
 fs.writeFileSync('materials/index.html',html);
 const summary={innerHTML:''};
 const context=vm.createContext({window:{CollectionBrowserCore:core,TosNewsMedia:newsMedia},document:{querySelector:selector=>selector==='#news-summary'?summary:null},URLSearchParams});
 vm.runInContext(fs.readFileSync('assets/js/news.js','utf8'),context);
 const api=vm.runInContext('({newsCard,newsDefaultVisible,renderNewsSummary})',context);
 const news=JSON.parse(fs.readFileSync('data/news.json')).filter(x=>x.status!=='draft').filter(api.newsDefaultVisible).sort((a,b)=>String(b.published_at||b.date||'').localeCompare(String(a.published_at||a.date||'')));
 const toses=JSON.parse(fs.readFileSync('data/toses.json'));
 const pageSize=24, totalPages=Math.max(1,Math.ceil(news.length/pageSize));
 replaceMount('news/index.html','news-feed',news.slice(0,pageSize).map(x=>api.newsCard(x,toses)).join(''));
 function pagination(page){
  const link=(number,label)=>`<a class="btn" href="${number===1?'/news/':'/news/archive/'+number+'/'}">${label}</a>`;
  return totalPages>1?`${page>1?link(page-1,'← Предыдущая'):''}<span>Страница ${page} из ${totalPages}</span>${page<totalPages?link(page+1,'Следующая →'):''}`:'';
 }
 function pager(html,page){return html.replace(/(<nav[^>]*id="news-pagination"[^>]*>)[\s\S]*?<\/nav>/,(_,open)=>open+pagination(page)+'</nav>');}
 fs.writeFileSync('news/index.html',pager(fs.readFileSync('news/index.html','utf8'),1));
 api.renderNewsSummary(news,news.length);replaceMount('news/index.html','news-summary',summary.innerHTML);
 const newsTemplate=fs.readFileSync('news/index.html','utf8');
 const archiveRoot='news/archive';
 if(fs.existsSync(archiveRoot))for(const name of fs.readdirSync(archiveRoot)){
  const file=path.join(archiveRoot,name,'index.html');
  if(/^\d+$/.test(name)&&Number(name)>totalPages&&fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('Generated paginated news archive'))fs.rmSync(path.dirname(file),{recursive:true});
 }
 for(let page=2;page<=totalPages;page++){
  const file=path.join(archiveRoot,String(page),'index.html');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  let archive=newsTemplate.replace(/<title>[\s\S]*?<\/title>/,`<title>Архив новостей — страница ${page} | ТОС БГО</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*/,`$1https://tosborisoglebsk.ru/news/archive/${page}/`)
    .replace(/(<meta property="og:url" content=")[^"]*/,`$1https://tosborisoglebsk.ru/news/archive/${page}/`)
    .replace(/(<meta name="description" content=")[^"]*/,`$1Новости, фотографии и полезные материалы территориальных общественных самоуправлений Борисоглебского округа. Архив: страница ${page} из ${totalPages}.`)
    .replace(/<h1>Новости(?: и материалы)?<\/h1>/,`<h1>Архив новостей — страница ${page}</h1>`)
    .replace('<!-- collection:news-feed:start -->'+newsTemplate.split('<!-- collection:news-feed:start -->')[1].split('<!-- collection:news-feed:end -->')[0]+'<!-- collection:news-feed:end -->',
      '<!-- collection:news-feed:start -->'+news.slice((page-1)*pageSize,page*pageSize).map(item=>api.newsCard(item,toses)).join('')+'<!-- collection:news-feed:end -->');
  archive=pager(archive,page).replace('</body>','<!-- Generated paginated news archive --></body>');
  fs.writeFileSync(file,archive);
 }
 // Keep the needs page usable without JavaScript or a working JSON endpoint.
 // Only substantive entries belong to the default needs list; editorial
 // data-collection requests remain discoverable through ?origin=request.
 const needsSummary={innerHTML:''};
 const needsContext=vm.createContext({
   window:{CollectionBrowserCore:core},
   document:{querySelector:selector=>selector==='#needs-summary'?needsSummary:null},
   URLSearchParams
 });
 vm.runInContext(fs.readFileSync('assets/js/needs.js','utf8'),needsContext);
 const needsApi=vm.runInContext('({needsPublished,needsDefaultVisible,needCard,renderNeedsSummary})',needsContext);
 const allNeeds=JSON.parse(fs.readFileSync('data/needs.json','utf8')).filter(needsApi.needsPublished);
 const visibleNeeds=allNeeds.filter(needsApi.needsDefaultVisible).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const needsFallback=visibleNeeds.length
   ?visibleNeeds.map(item=>needsApi.needCard(item,toses)).join('')
   :'<div class="empty">Проверенных актуальных потребностей пока нет. Передайте подтверждённую просьбу через страницу контактов.</div>';
 replaceMount('needs/index.html','needs-list',needsFallback);
 needsApi.renderNeedsSummary(visibleNeeds,visibleNeeds.length);
 replaceMount('needs/index.html','needs-summary',needsSummary.innerHTML);
 console.log(`Readable fallback: ${news.length} news, ${materialItems.length} materials, ${visibleNeeds.length} substantive needs (${allNeeds.length-visibleNeeds.length} editorial requests excluded)`);
}
if(require.main===module)main();
module.exports={main};
