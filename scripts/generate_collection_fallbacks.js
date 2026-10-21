const fs=require('fs'),vm=require('vm');
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
 const api=vm.runInContext('({newsCard,newsFeatured,newsDefaultVisible,renderNewsSummary})',context);
 const news=JSON.parse(fs.readFileSync('data/news.json')).filter(x=>x.status!=='draft').filter(api.newsDefaultVisible).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const toses=JSON.parse(fs.readFileSync('data/toses.json'));
 replaceMount('news/index.html','news-feed',news.map(x=>api.newsCard(x,toses)).join(''));
 api.renderNewsSummary(news,news.length);replaceMount('news/index.html','news-summary',summary.innerHTML);
 const featuredId=fs.readFileSync('news/index.html','utf8').match(/data-news-featured="([^"]+)"/)?.[1];
 const featured=news.find(item=>item.id===featuredId);
 if(!featured||!api.newsFeatured(featured,toses))throw new Error('Highlighted news must refer to a published, verified record');
 replaceMount('news/index.html','news-featured',api.newsFeatured(featured,toses));
 const doneSummary={innerHTML:''};
 const doneContext=vm.createContext({window:{CollectionBrowserCore:core},document:{querySelector:selector=>selector==='#done-summary'?doneSummary:null},URLSearchParams});
 vm.runInContext(fs.readFileSync('assets/js/done.js','utf8'),doneContext);
 const doneApi=vm.runInContext('({doneCard,donePublished,doneDefaultVisible,renderDoneSummary})',doneContext);
 const done=JSON.parse(fs.readFileSync('data/done.json')).filter(doneApi.donePublished).filter(doneApi.doneDefaultVisible).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 replaceMount('done/index.html','done-list',done.map(item=>doneApi.doneCard(item,toses)).join(''));
 doneApi.renderDoneSummary(done,done.length);replaceMount('done/index.html','done-summary',doneSummary.innerHTML);
 console.log(`Readable fallback: ${news.length} news, ${done.length} results, ${materialItems.length} materials; highlighted news synchronized`);
}
if(require.main===module)main();
module.exports={main};
