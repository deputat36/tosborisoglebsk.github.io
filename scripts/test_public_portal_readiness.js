'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const BASE=process.env.PUBLIC_BROWSER_BASE_URL||process.env.VISUAL_BASELINE_BASE_URL||'http://127.0.0.1:4173';
const OUT='.artifacts/visual-baseline/portal-readiness';
async function go(page,route){const r=await page.goto(BASE+route,{waitUntil:'networkidle'});assert(r.ok());}
async function fit(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' fits');}
async function main(){fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({headless:true});const errors=[];try{
 for(const width of [320,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  await ctx.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedPortalText=text;}}});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await go(page,'/sections/#choose-task');await page.locator('[data-task-controls]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-task-card]:visible').count(),9);
  if(width>=1000){const positions=await page.locator('[data-task-card]').evaluateAll(nodes=>nodes.slice(0,3).map(n=>({top:n.getBoundingClientRect().top,left:n.getBoundingClientRect().left})));assert(Math.abs(positions[0].top-positions[1].top)<2&&positions[1].left>positions[0].left,'desktop task cards must share a row');}
  await page.locator('[data-task-query]').fill('СМЕТА');assert.equal(await page.locator('[data-task-card]:visible').count(),1);assert.equal(await page.locator('[data-task-card]:visible a').getAttribute('href'),'/documents/templates/project-kit/');
  await page.locator('[data-task-query]').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('[data-task-card]:visible').count(),0);assert(await page.locator('[data-task-empty]').isVisible());
  await page.locator('[data-task-reset]').click();await page.locator('select[data-task-audience]').selectOption('partner');assert.equal(await page.locator('[data-task-card="learning"]').isVisible(),false);
  await page.locator('[data-task-reset]').click();await fit(page,'task finder '+width);
  await page.locator('#choose-task').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(OUT,'tasks-'+width+'.png')});
  await go(page,'/methodology/#project-evidence');assert.equal(await page.locator('[data-portal-metric]').count(),6);await fit(page,'project evidence '+width);
  assert.equal(await page.locator('script[data-portal-breadcrumb-schema]').count(),1);assert.equal(await page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.filter(n=>JSON.parse(n.textContent)['@type']==='BreadcrumbList').length),1,'runtime does not duplicate static breadcrumbs');
  const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Скачать описание и показатели',exact:true}).click();const downloaded=await pending;const file=await downloaded.path();const brief=fs.readFileSync(file,'utf8');assert(brief.includes('ПОДТВЕРЖДЕНИЕ ПОЛЬЗЫ'));
  await page.locator('[data-share-copy="invite"]').click();const text=await page.evaluate(()=>window.__copiedPortalText);assert(text.includes('https://tosborisoglebsk.ru/sections/#choose-task'));assert(!text.includes('?q='));
  await page.locator('#project-evidence').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(OUT,'evidence-'+width+'.png')});
  await ctx.close();
 }
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});const p=await nojs.newPage();await go(p,'/sections/');assert.equal(await p.locator('[data-task-card]:visible').count(),9);assert.equal(await p.locator('[data-task-controls]').isVisible(),false);await fit(p,'no-script tasks');await go(p,'/methodology/');assert.equal(await p.locator('[data-portal-metric]:visible').count(),6);await fit(p,'no-script evidence');await nojs.close();
 assert.deepEqual(errors,[]);console.log('Portal readiness browser OK: desktop/mobile/no-script tasks, safe empty search, role filter, current evidence, one breadcrumb, brief download and private clipboard payload');
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
