#!/usr/bin/env node
// Production-client API contract integration: synthetic HTTP stub, no real codes or assignments.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BATTLE_DEMO_BASE_URL || 'http://127.0.0.1:4173';
const API = 'https://testing-only.supabase.co/functions/v1/culinary-battle';
const eventId = 'culinary-battle-2026';
const teams = Array.from({length:26},(_,i)=>({
  id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
  name:'Test TOS '+String(i+1).padStart(2,'0')
}));
async function main(){
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const errors=[],postRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route(BASE+'/culinary-battle/**',async route=>{
      if(route.request().resourceType()==='document'){
        const origin=await route.fetch();
        const original=await origin.text();
        assert(original.includes('<meta name="culinary-battle-api" content=""/>'));
        return route.fulfill({response:origin,body:original.replace(
          '<meta name="culinary-battle-api" content=""/>',
          '<meta name="culinary-battle-api" content="'+API+'"/>'
        )});
      }
      return route.continue();
    });
    await page.route(API+'**',async route=>{
      const req=route.request();
      if(req.method()==='GET'){
        assert(req.url().includes('event='+eventId));
        return route.fulfill({status:200,contentType:'application/json',headers:{
          'access-control-allow-origin':BASE,
          'cache-control':'no-store'
        },body:JSON.stringify({
          status:'open',teams,total_teams:26,total_dishes:19,remaining:19
        })});
      }
      assert.equal(req.method(),'POST');
      const body=req.postDataJSON();
      assert.equal(body.event,eventId);
      assert.equal(body.team_id,teams[0].id);
      postRequests.push(body);
      if(body.code!=='REAL-TEST-CODE'){
        return route.fulfill({status:401,contentType:'application/json',
          headers:{'access-control-allow-origin':BASE},
          body:JSON.stringify({error:'invalid_credentials'})});
      }
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':BASE},
        body:JSON.stringify({
          team_name:teams[0].name,dish_name:'Хуплу',
          revealed_at:'2026-11-12T15:00:00+03:00',first_open:true,remaining:18
        })});
    });
    const r=await page.goto(BASE+'/culinary-battle/?demo=1',{waitUntil:'domcontentloaded'});
    assert.equal(r.status(),200);
    await page.waitForFunction(()=>!document.getElementById('battle-team').disabled);
    assert.equal(await page.locator('.battle-demo-banner').count(),0,
      'Demo must be disabled when API endpoint configured');
    assert.equal(await page.locator('#battle-team option').count(),27);
    await page.locator('#battle-team').selectOption(teams[0].id);
    await page.locator('#battle-code').fill('wrong');
    await page.locator('#battle-submit').click();
    await page.locator('#battle-error').waitFor({state:'visible'});
    assert.match(await page.locator('#battle-error').innerText(),/Неверный код/);
    assert.equal(await page.locator('#battle-result').isVisible(),false);
    await page.locator('#battle-code').fill('REAL-TEST-CODE');
    await page.locator('#battle-submit').click();
    await page.locator('#battle-result').waitFor({state:'visible'});
    assert.equal(await page.locator('#battle-result-dish').innerText(),'Хуплу');
    assert.match(await page.locator('#battle-remaining').innerText(),/18 из 19/);
    assert.equal(postRequests.length,2);
    assert.deepEqual(errors,[]);
    await page.close();
    process.stdout.write('PASS: live API configuration, no demo, 26 teams, invalid code, valid reveal, remaining counter\n');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
