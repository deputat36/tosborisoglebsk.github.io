const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const expectedNews=JSON.parse(fs.readFileSync('data/news.json')).filter(x=>x.status!=='draft'&&x.content_origin!=='request'&&!String(x.id).startsWith('send-news-')).length;
const expectedMaterials=require('../assets/js/materials-core').buildCatalog(JSON.parse(fs.readFileSync('data/materials.json')),JSON.parse(fs.readFileSync('data/articles.json'))).length;
const expectedDone=JSON.parse(fs.readFileSync('data/done.json')).filter(x=>x.status!=='draft'&&x.content_origin!=='request').length;
(async()=>{const b=await chromium.launch();for(const width of [390,1440])for(const mode of ['normal','no-js','failed-data']){
 const c=await b.newContext({viewport:{width,height:900},javaScriptEnabled:mode!=='no-js'});
 if(mode==='failed-data')await c.route('**/data/*.json',r=>r.fulfill({status:503,body:'unavailable'}));
 for(const [route,selector,count]of [['/news/','#news-feed > article',expectedNews],['/done/','#done-list > article.done-story',expectedDone],['/materials/','#articles-list > article',expectedMaterials]]){
 const p=await c.newPage();await p.goto('http://127.0.0.1:4173'+route);
 const search=route==='/done/'?'#done-search':route==='/news/'?'#news-search':null;
 if(search&&mode==='normal')await p.locator(search+':enabled').waitFor();
 assert.equal(await p.locator(selector).count(),count);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.equal((await p.locator('body').innerText()).includes('Проверьте файл data/'),false);
 if(route==='/news/'&&mode==='normal'){await p.locator('#news-search').fill('Подстепки');await p.waitForTimeout(150);assert.ok(await p.locator(selector).count()>0);assert.ok(await p.locator(selector).count()<expectedNews)}
 if(route==='/news/'&&mode==='failed-data')assert.equal(await p.locator('#news-search').isDisabled(),true);
 if(route==='/done/'&&mode==='normal'){await p.locator('#done-search').fill('Губари');await p.waitForFunction(count=>{const n=document.querySelectorAll('#done-list > article.done-story').length;return n>0&&n<count},expectedDone)}
 if(route==='/done/'&&mode==='failed-data')assert.equal(await p.locator('#done-search').isDisabled(),true);
 if(route==='/done/'){const details=p.locator('#done-list > article.done-story details').first();await details.locator('summary').click();assert.equal(await details.evaluate(el=>el.open),true)}
 await p.close();
 }await c.close();console.log('Reader collections OK',width,mode)
}await b.close()})().catch(e=>{console.error(e);process.exit(1)});
