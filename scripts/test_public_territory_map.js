const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const BASE=process.env.PUBLIC_BROWSER_BASE_URL||process.env.VISUAL_BASELINE_BASE_URL||'http://127.0.0.1:4173';
const OUT='.artifacts/visual-baseline/territory-map';fs.mkdirSync(OUT,{recursive:true});
const catalog=JSON.parse(fs.readFileSync('data/toses.json','utf8')),slug=catalog.find(t=>t.name==='Уютный')?.slug||catalog[0].slug,KEY='tos-territory-map-v1';
const report={scenarios:[],errors:[],mockedTileRequests:0};
const loc=(p,k)=>p.locator('[data-map-'+k+']');
const coordinates='51.368 42.075\n51.368 42.077\n51.370 42.077\n51.370 42.075';
const go=async(p,query='')=>{assert((await p.goto(BASE+'/map/'+query,{waitUntil:'networkidle'})).ok());await loc(p,'app').waitFor({state:'visible'});};
const setup=async(p)=>{p.on('pageerror',e=>report.errors.push(e.message));await p.route('https://tile.openstreetmap.org/**',async route=>{report.mockedTileRequests++;await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});});};
const create=async(p)=>{await loc(p,'start').click();await loc(p,'tos').selectOption(slug);await loc(p,'coordinate-editor').locator('summary').click();await loc(p,'coordinates').fill(coordinates);await loc(p,'apply-coordinates').click();assert.equal(await loc(p,'areas').locator('button').count(),1);};
const bodyDownload=async(p,key)=>{const promise=p.waitForEvent('download');await loc(p,key).click();const d=await promise;return fs.readFileSync(await d.path(),'utf8');};
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const width of [320,390,768,1280]){
    const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});const page=await context.newPage();await setup(page);await go(page,'?tos='+slug);
    assert.equal(await loc(page,'tos').inputValue(),slug);assert.equal(await loc(page,'fit').isDisabled(),true);assert.equal(report.mockedTileRequests,0);await create(page);
    await loc(page,'undo').click();assert.equal(await loc(page,'areas').locator('button').count(),0);await loc(page,'redo').click();assert.equal(await loc(page,'areas').locator('button').count(),1);
    await loc(page,'areas').locator('button').first().click();await page.waitForTimeout(400);
    await loc(page,'hole').click();const canvas=page.locator('#territory-map');const b=await canvas.boundingBox();for(const [x,y]of [[-12,-12],[12,-12],[12,12],[-12,12]])await canvas.click({position:{x:b.width/2+x,y:b.height/2+y}});await loc(page,'finish').click();
    let exported=JSON.parse(await bodyDownload(page,'export'));assert.equal(exported.features[0].geometry.coordinates.length,2,'hole preserved '+width);assert.equal(exported.metadata.status,'draft');
    await loc(page,'check').click();assert((await loc(page,'check-results').innerText()).includes('Пересечений контуров'));
    await page.reload({waitUntil:'networkidle'});await loc(page,'start').click();assert.equal(await loc(page,'areas').locator('button').count(),1);exported=JSON.parse(await bodyDownload(page,'export'));assert.equal(exported.features[0].geometry.coordinates.length,2,'hole survives reload');
    await loc(page,'areas').locator('button').first().click();await loc(page,'source').fill('Документ учебной проверки');await loc(page,'note').fill('<img src=x onerror=alert(1)>');await loc(page,'save-description').click();
    const csv=await bodyDownload(page,'csv'),svg=await bodyDownload(page,'svg');assert(csv.includes('Документ учебной проверки'));assert(svg.startsWith('<svg'));assert(!svg.includes('tile.openstreetmap'));
    await loc(page,'public').click();assert.equal(await page.locator('.map-vertex').count(),0);assert((await loc(page,'stat').innerText()).includes('контуры 0'));assert(!await loc(page,'inspector').isVisible());
    await loc(page,'share').click();assert((await loc(page,'share-output').inputValue()).endsWith('/map/?tos='+slug));
    await loc(page,'start').click();assert.equal(await loc(page,'areas').locator('button').count(),1);
    await loc(page,'areas').locator('button').first().click();await loc(page,'coordinate-editor').locator('summary').click();await loc(page,'ring').selectOption('1');await loc(page,'coordinates').fill('51.3685 42.0755\n51.3685 42.076\n51.369 42.076');await loc(page,'apply-coordinates').click();exported=JSON.parse(await bodyDownload(page,'export'));assert.equal(exported.features[0].geometry.coordinates.length,2);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile width '+width);
    await page.locator('#territory-map').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(OUT,'editor-'+width+'.png')});
    report.scenarios.push({width,status:'passed',checks:['query','keyboard coordinates','undo redo','draw hole','export','reload','public separation','coordinate editing','overflow']});await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});const page=await context.newPage();await setup(page);await go(page);await loc(page,'start').click();
  const polygon=[[[42.075,51.368],[42.077,51.368],[42.077,51.370],[42.075,51.370],[42.075,51.368]],[[42.0755,51.3685],[42.076,51.3685],[42.076,51.369],[42.0755,51.3685]]];
  const imported={type:'FeatureCollection',features:[{type:'Feature',id:'multipart',properties:{slug,verification_status:'verified'},geometry:{type:'MultiPolygon',coordinates:[polygon,[[[42.08,51.368],[42.081,51.368],[42.081,51.369],[42.08,51.369],[42.08,51.368]]]]}}]};
  await loc(page,'file').setInputFiles({name:'example.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(imported))});assert.equal(await loc(page,'areas').locator('button').count(),2);let exported=JSON.parse(await bodyDownload(page,'export'));assert.equal(exported.features[0].geometry.coordinates.length,2);assert(exported.features.every(f=>f.properties.verification_status===undefined));
  // Invalid import must leave the previous valid draft intact.
  await loc(page,'file').setInputFiles({name:'bad.geojson',mimeType:'application/geo+json',buffer:Buffer.from('{"type":"FeatureCollection","features":[{}]}')});assert.equal(await loc(page,'areas').locator('button').count(),2);assert((await loc(page,'status').innerText()).includes('разрешены'));
  // Check new contours through actual map clicks, without external tile requests.
  await loc(page,'tos').selectOption(catalog.find(t=>t.slug!==slug).slug);await loc(page,'city').click();await loc(page,'draw').click();const canvas=page.locator('#territory-map'),box=await canvas.boundingBox();for(const [x,y]of [[20,20],[70,20],[70,70],[20,70]])await canvas.click({position:{x:box.width/2+x,y:box.height/2+y}});await loc(page,'finish').click();assert.equal(await loc(page,'areas').locator('button').count(),3);
  const before=await page.evaluate(k=>localStorage.getItem(k),KEY);const other=await context.newPage();await setup(other);await go(other);await loc(other,'start').click();await loc(other,'areas').locator('button').first().click();await loc(other,'note').fill('Изменение из другой вкладки');await loc(other,'save-description').click();await page.waitForTimeout(250);assert(await loc(page,'draw').isDisabled());assert.notEqual(await page.evaluate(k=>localStorage.getItem(k),KEY),before);assert((await loc(page,'status').innerText()).includes('другой вкладке'));
  const previousTiles=report.mockedTileRequests;await loc(other,'tiles').click();await other.waitForTimeout(200);assert.equal(await loc(other,'tiles').getAttribute('aria-pressed'),'true');assert(report.mockedTileRequests>previousTiles);await loc(other,'tiles').click();await context.close();
  report.scenarios.push({scenario:'multipart import; invalid file; new drawing; concurrent editing; mocked tiles',status:'passed'});
  for(const mode of ['blocked','corrupt']){
    const c=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});await c.addInitScript(({key,mode})=>{if(mode==='corrupt')localStorage.setItem(key,'broken-original');else {const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Storage blocked','QuotaExceededError');return set.call(this,k,v);};}},{key:KEY,mode});
    const p=await c.newPage();await setup(p);await go(p);await create(p);assert((await loc(p,'status').innerText()).toLowerCase().includes('скачайте'));assert.equal(JSON.parse(await bodyDownload(p,'export')).features.length,1);if(mode==='corrupt')assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),'broken-original');await c.close();report.scenarios.push({scenario:mode+' storage preserves export',status:'passed'});
  }
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});const p=await nojs.newPage();assert((await p.goto(BASE+'/map/')).ok());assert(await loc(p,'fallback').isVisible());assert(await p.locator('[data-map-fallback] img').evaluate(img=>img.complete&&img.naturalWidth>0));assert.equal(await p.locator('[data-map-app]').isVisible(),false);await nojs.close();report.scenarios.push({scenario:'no JavaScript fallback',status:'passed'});
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('Public territory map: '+report.scenarios.length+' scenarios passed; tile toggle uses mock responses only');
}finally{await browser.close();}})().catch(e=>{report.errors.push(e.stack);fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exit(1);});
