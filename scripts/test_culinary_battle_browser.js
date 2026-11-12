#!/usr/bin/env node
// Chromium E2E for sample browser-local draw only. NOT a concurrency test of real backend.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const BASE=process.env.BATTLE_DEMO_BASE_URL||'http://127.0.0.1:4173';
const OUTPUT=path.resolve('.artifacts/culinary-battle');
const code=(i)=>'DEMO-'+String(i).padStart(2,'0')+'-2026';
async function run(){
  fs.mkdirSync(OUTPUT,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const viewport of [{name:'desktop',width:1366,height:900},{name:'mobile',width:390,height:844}]){
      const context=await browser.newContext({
        viewport:{width:viewport.width,height:viewport.height},
        reducedMotion:'reduce',acceptDownloads:true
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto(BASE+'/culinary-battle/?demo=1',{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.waitForFunction(()=>!document.getElementById('battle-team').disabled);
      assert.equal(await page.locator('#battle-team option').count(),27);
      assert.match(await page.locator('#battle-status').innerText(),/26 ТОСов, 19 блюд/);
      assert.match(await page.locator('#battle-remaining').innerText(),/осталось 19 из 19/);
      assert.match(await page.locator('.battle-demo-banner').innerText(),/ДЕМО/);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<3,'Mobile horizontal overflow: '+overflow);
      await page.screenshot({path:path.join(OUTPUT,'demo-'+viewport.name+'.png'),fullPage:true});

      await page.locator('#battle-search').fill('Восточный');
      assert.equal(await page.locator('#battle-team option').count(),2);
      await page.locator('#battle-team').selectOption('demo-02');
      assert.match(await page.locator('#battle-demo-code-hint').innerText(),/DEMO-02-2026/);
      await page.locator('#battle-code').fill(code(1));
      await page.locator('#battle-submit').click();
      await page.locator('#battle-error').waitFor({state:'visible'});
      assert.match(await page.locator('#battle-error').innerText(),/другой учебный код/);
      assert.equal(await page.locator('#battle-result').isVisible(),false);

      await page.locator('#battle-code').fill(code(2));
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({state:'visible'});
      assert.equal(await page.locator('#battle-result-team').innerText(),'ТОС «Восточный»');
      const firstDish=await page.locator('#battle-result-dish').innerText();
      assert.ok(firstDish.length>=4);
      assert.match(await page.locator('#battle-remaining').innerText(),/осталось 18 из 19/);
      await page.screenshot({path:path.join(OUTPUT,'result-'+viewport.name+'.png'),fullPage:true});
      const down=page.waitForEvent('download');
      await page.locator('#battle-download').click();
      const png=await down;assert.ok(png.suggestedFilename().endsWith('.png'));
      const saved=path.join(OUTPUT,'download-'+viewport.name+'.png');
      await png.saveAs(saved);
      assert.equal(fs.readFileSync(saved).subarray(0,8).toString('hex'),'89504e470d0a1a0a');

      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!document.getElementById('battle-team').disabled);
      await page.locator('#battle-team').selectOption('demo-02');
      await page.locator('#battle-code').fill(code(2));
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({state:'visible'});
      assert.equal(await page.locator('#battle-result-dish').innerText(),firstDish);
      assert.match(await page.locator('#battle-remaining').innerText(),/осталось 18 из 19/);

      await page.locator('#battle-search').fill('');
      for(let index=3;index<=20;index++){
        await page.locator('#battle-team').selectOption('demo-'+String(index).padStart(2,'0'));
        assert.equal(await page.locator('#battle-result').isVisible(),false);
        await page.locator('#battle-code').fill(code(index));
        await page.locator('#battle-submit').click();
        await page.locator('#battle-result').waitFor({state:'visible'});
      }
      assert.match(await page.locator('#battle-remaining').innerText(),/осталось 0 из 19/);
      assert.match(await page.locator('#battle-status').innerText(),/ДЕМО завершено/);
      await page.locator('#battle-team').selectOption('demo-25');
      assert.match(await page.locator('#battle-demo-code-hint').innerText(),/DEMO-25-2026/);
      await page.locator('#battle-code').fill(code(25));
      await page.locator('#battle-submit').click();
      assert.match(await page.locator('#battle-error').innerText(),/Все 19 блюд уже распределены/);
      assert.equal(await page.locator('#battle-result').isVisible(),false);
      await page.locator('#battle-team').selectOption('demo-26');
      assert.match(await page.locator('#battle-demo-code-hint').innerText(),/DEMO-26-2026/);
      await page.locator('#battle-code').fill(code(26));
      await page.locator('#battle-submit').click();
      assert.match(await page.locator('#battle-error').innerText(),/Все 19 блюд уже распределены/);
      await page.locator('#battle-team').selectOption('demo-02');
      await page.locator('#battle-code').fill(code(2));
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({state:'visible'});
      assert.equal(await page.locator('#battle-result-dish').innerText(),firstDish);
      // Production route never uses sample data or fake codes.
      await page.goto(BASE+'/culinary-battle/',{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('#battle-submit').isDisabled(),true);
      assert.equal(await page.locator('.battle-demo-banner').count(),0);
      assert.deepEqual(errors,[],'Uncaught script errors');
      await context.close();
      console.log('PASS '+viewport.name+': 26 TOS, 19 distinct draws, sold-out, repeat, PNG, demo separation');
    }
  } finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
