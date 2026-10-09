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
 const materialItems=JSON.parse(fs.readFileSync('data/materials.json')).filter(x=>x.status!=='draft');
 replaceMount('materials/index.html','articles-list',materialItems.map(materials.render).join(''));
 let html=fs.readFileSync('materials/index.html','utf8').replace('class="container list" id="articles-list"','class="container grid" id="articles-list"');fs.writeFileSync('materials/index.html',html);
 const summary={innerHTML:''};
 const context=vm.createContext({window:{CollectionBrowserCore:core,TosNewsMedia:newsMedia},document:{querySelector:selector=>selector==='#news-summary'?summary:null},URLSearchParams});
 vm.runInContext(fs.readFileSync('assets/js/news.js','utf8'),context);
 const api=vm.runInContext('({newsCard,newsDefaultVisible,renderNewsSummary})',context);
 const news=JSON.parse(fs.readFileSync('data/news.json')).filter(x=>x.status!=='draft').filter(api.newsDefaultVisible).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const toses=JSON.parse(fs.readFileSync('data/toses.json'));
 replaceMount('news/index.html','news-feed',news.map(x=>api.newsCard(x,toses)).join(''));
 api.renderNewsSummary(news,news.length);replaceMount('news/index.html','news-summary',summary.innerHTML);
 console.log(`Readable fallback: ${news.length} news, ${materialItems.length} materials`);
}
if(require.main===module)main();
module.exports={main};
