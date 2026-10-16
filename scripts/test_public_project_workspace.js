const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const core = require('../assets/js/project-workspace-core');
const budgetCore = require('../assets/js/project-budget-core');
const BASE = (process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/,'');
const OUT = process.env.PROJECT_WORKSPACE_OUTPUT || '.artifacts/visual-baseline/project-workspace';
const report = {scenarios:[],errors:[]};
fs.mkdirSync(OUT,{recursive:true});
const field = (page,key) => page.locator(`[data-project-field="${key}"]`);
const common = (page,key) => page.locator(`[data-project-common="${key}"]`).first();
const plain = value => value.replace(/\s/g,' ');
async function open(page,form) {
  const response=await page.goto(`${BASE}/documents/templates/project-${form}/`,{waitUntil:'networkidle'});
  assert(response.ok(),`${form}: HTTP ${response.status()}`);
  await page.waitForFunction(()=>document.querySelector('[data-project-status]')?.textContent.length>0);
}
async function width(page,label) {
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: horizontal overflow`);
}
async function screenshot(page,name) { await width(page,name);await page.screenshot({path:path.join(OUT,`${name}.png`),fullPage:true}); }
async function downloadProject(page) {
  const wait=page.waitForEvent('download');await page.locator('[data-project-action="export"]').click();
  const file=await wait;return JSON.parse(fs.readFileSync(await file.path(),'utf8'));
}
async function scenario(browser,mobile) {
  const label=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},acceptDownloads:true});
  const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());page.on('pageerror',error=>report.errors.push(`${label}: ${error.message}`));
  await open(page,'kit');
  await common(page,'project').fill('Соседский сквер');
  await common(page,'territory').fill('Тестовый ТОС');
  await common(page,'responsible').fill('Команда проекта');
  await common(page,'contact').fill('Канал для связи');
  await common(page,'start').fill('01.05.2027');await common(page,'end').fill('30.06.2027');
  await page.locator('details summary').filter({hasText:'Цель, проблема'}).click();
  await common(page,'goal').fill('Место для встреч и отдыха');
  await common(page,'summary').fill('Обустройство сквера вместе с жителями');
  await screenshot(page,`${label}-project-kit`);
  await open(page,'passport');
  assert.equal(await common(page,'project').innerText(),'Соседский сквер');
  assert.equal(await common(page,'goal').innerText(),'Место для встреч и отдыха');
  await field(page,'f7').fill('Согласование площадки');
  await common(page,'responsible').fill('Инициативная группа');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await field(page,'f7').innerText(),'Согласование площадки','table edits are restored');
  // Numeric fields remain owned by the calculator; shared metadata is owned by the project.
  await open(page,'budget');
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'Соседский сквер');
  await page.locator('[data-group="expenses"][data-index="0"][data-field="item"]').fill('Материалы');
  await page.locator('[data-group="expenses"][data-index="0"][data-field="quantity"]').fill('2');
  await page.locator('[data-group="expenses"][data-index="0"][data-field="price"]').fill('350,25');
  await page.locator('[data-group="contributions"][data-index="0"][data-field="value"]').fill('1200');
  await page.locator('[data-funding="own"]').fill('100');await page.locator('[data-funding="partners"]').fill('50');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tos-project-workspace-v1')).budget?.partners==='50');
  await screenshot(page,`${label}-project-budget`);
  // Clearing only the calculator keeps the identity of the current project.
  await page.locator('#budget-clear').click();
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'Соседский сквер');
  await page.locator('#budget-undo').click();
  await page.reload({waitUntil:'networkidle'});
  // A new project started from an already restored budget must also start empty.
  await page.locator('[data-project-action="new"]').click();
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'');
  await page.locator('[data-project-action="undo"]').click();
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'Соседский сквер');
  await open(page,'passport');
  assert.equal(plain(await field(page,'f27').innerText()),'700,50 ₽');
  assert.equal(plain(await field(page,'f28').innerText()),'550,50 ₽');
  await open(page,'final-report');
  assert.equal(plain(await field(page,'f20').innerText()),'1 900,50 ₽');
  assert.equal(await field(page,'f21').innerText(),'','actual cost stays blank');
  assert.equal(await field(page,'f6').innerText(),'','actual outcome stays blank');
  assert.equal(await field(page,'f2').innerText(),'01.05.2027 — 30.06.2027');
  await field(page,'f20').fill('Ручной план');await page.reload({waitUntil:'networkidle'});
  assert.equal(await field(page,'f20').innerText(),'Ручной план');
  await page.locator('[data-project-action="budget"]').click();
  assert.equal(plain(await field(page,'f20').innerText()),'1 900,50 ₽');
  await screenshot(page,`${label}-project-report`);
  // Every independent form contributes its edits to the same export.
  for(const form of ['problem','support','schedule','partner-letter','checklist','photo-report']) {
    await open(page,form);
    const local=page.locator('[data-project-field]:not([data-project-common]):not([data-project-derived]):not([data-project-budget])').first();
    const key=await local.getAttribute('data-project-field');await local.fill(`Черновик: ${form}`);
    await page.reload({waitUntil:'networkidle'});assert.equal(await field(page,key).innerText(),`Черновик: ${form}`);
    await width(page,`${label}-${form}`);
  }
  await open(page,'support');
  await field(page,'f100').fill('Участник проекта');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await field(page,'f100').innerText(),'Участник проекта');
  await screenshot(page,`${label}-project-support`);
  const exported=await downloadProject(page);
  assert.equal(exported.common.project,'Соседский сквер');assert.equal(exported.budget.expenses[0].price,'350,25');
  assert(Object.keys(exported.documents).length>=8);
  await page.locator('[data-project-action="new"]').click();
  await open(page,'budget');assert.equal(await page.locator('[data-meta="project"]').inputValue(),'');
  assert.equal(await page.locator('[data-group="expenses"][data-index="0"][data-field="price"]').inputValue(),'','new project cannot resurrect previous budget');
  await page.locator('[data-project-file]').setInputFiles({name:'proekt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'Соседский сквер');
  await page.locator('[data-project-action="undo"]').click();assert.equal(await page.locator('[data-meta="project"]').inputValue(),'');
  await page.locator('[data-project-file]').setInputFiles({name:'proekt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.locator('[data-project-file]').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from('{"kind":"wrong"}')});
  assert.match(await page.locator('[data-project-notice]').innerText(),/Файл не открыт/);
  assert.equal(await page.locator('[data-meta="project"]').inputValue(),'Соседский сквер','invalid import preserves project');
  await open(page,'passport');
  await common(page,'project').fill('');await page.reload({waitUntil:'networkidle'});assert.equal(await common(page,'project').innerText(),'','cleared shared fields stay empty');
  const literal='<img src=x onerror=alert(1)>';
  await common(page,'project').fill(literal);await page.reload({waitUntil:'networkidle'});
  assert.equal(await common(page,'project').innerText(),literal);assert.equal(await common(page,'project').locator('img').count(),0,'restored text cannot become HTML');
  // Text-only paste prevents rich clipboard markup from entering a contenteditable.
  await field(page,'f7').evaluate(el=>{el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);const data=new DataTransfer();data.setData('text/plain','Вставка текста');data.setData('text/html','<img src=x onerror=alert(1)>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  assert.equal(await field(page,'f7').innerText(),'Вставка текста');assert.equal(await field(page,'f7').locator('img').count(),0);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.project-workspace-panel').isVisible(),false,'editing controls are excluded from print');await page.emulateMedia({media:'screen'});
  // Concurrent edits cannot silently replace a newer project from another tab.
  const second=await context.newPage();second.on('dialog',dialog=>dialog.accept());await open(second,'kit');
  await common(second,'territory').fill('Из другой вкладки');
  await page.waitForFunction(()=>!document.querySelector('[data-project-reload]').hidden);
  await field(page,'f7').fill('Несохранённая правка');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tos-project-workspace-v1')).common.territory),'Из другой вкладки');
  const rescue=await downloadProject(page);assert.equal(rescue.documents.passport.f7,'Несохранённая правка','conflicting draft can still be downloaded');
  await page.locator('[data-project-action="reload"]').click();assert.equal(await common(page,'territory').innerText(),'Из другой вкладки');
  await context.close();report.scenarios.push(`${label}: nine forms, shared edits, persistence, calculations, planned/actual, full file, new project, undo, invalid import, text safety, print, conflict recovery`);
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    await scenario(browser,false);await scenario(browser,true);
    // Existing standalone calculator drafts migrate without data loss.
    const context=await browser.newContext();const page=await context.newPage();const legacy=budgetCore.fresh();legacy.meta.project='Старая смета';legacy.expenses[0]={category:'Материалы',item:'Краска',quantity:'2',price:'350',source:''};
    await context.addInitScript(value=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('tos-project-budget-v1',JSON.stringify(value));sessionStorage.setItem('seeded','1');}},legacy);
    await open(page,'kit');assert.equal(await common(page,'project').inputValue(),'Старая смета');await open(page,'passport');assert.equal(plain(await field(page,'f27').innerText()),'700,00 ₽');await context.close();report.scenarios.push('legacy budget migration');
    const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Disabled','QuotaExceededError');};});const p=await blocked.newPage();await open(p,'kit');await common(p,'project').fill('Без сохранения');assert.match(await p.locator('[data-project-status]').innerText(),/Автосохранение недоступно/);assert.equal((await downloadProject(p)).common.project,'Без сохранения');await blocked.close();report.scenarios.push('storage unavailable: explicit warning and complete export');
    const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const n=await nojs.newPage();await n.goto(`${BASE}/documents/templates/project-kit/`);assert.equal(await n.locator('a[href="/documents/templates/project-passport/"]').count()>=1,true);await n.goto(`${BASE}/documents/templates/project-passport/`);assert(await n.locator('[contenteditable]').count()>20);await width(n,'no JavaScript');await nojs.close();report.scenarios.push('all document links and printable blank remain available without JavaScript');
    assert.deepEqual(report.errors,[],'no page runtime errors');report.passed=true;
  } finally {await browser.close();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
