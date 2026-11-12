#!/usr/bin/env node
// Real public endpoint smoke: NEVER submits a valid code, does not assign dishes.
const assert=require('node:assert/strict');
const API='https://otulfnouybahfnsycxqn.supabase.co/functions/v1/tos-culinary-battle-2026';
const ORIGIN='https://tosborisoglebsk.ru';
async function main(){
  const get=await fetch(API+'?event=culinary-battle-2026',{
    headers:{Origin:ORIGIN,Accept:'application/json'},signal:AbortSignal.timeout(20000)
  });
  assert.equal(get.status,200,'GET returned '+get.status);
  assert.equal(get.headers.get('access-control-allow-origin'),ORIGIN);
  const state=await get.json();
  assert.ok(['draft','pilot','open','closed'].includes(state.status));
  assert.equal(state.total_teams,26);
  assert.equal(state.total_dishes,19);
  assert.equal(state.teams.length,26);
  assert.equal(new Set(state.teams.map(t=>t.id)).size,26);
  assert(state.teams.some(t=>t.id==='uyutnyy'&&t.name==='Уютный'));
  assert.equal(typeof state.remaining,'number');
  assert(state.remaining>=0 && state.remaining<=19);
  assert(!JSON.stringify(state).includes('code_hash'));
  assert(!JSON.stringify(state).includes('dish_name'));
  const wrong=await fetch(API,{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},
    body:JSON.stringify({event:'culinary-battle-2026',team_id:'uyutnyy',code:'NOT-A-REAL-CODE'}),
    signal:AbortSignal.timeout(20000)
  });
  assert.equal(wrong.status,401);
  assert.equal((await wrong.json()).error,'invalid_credentials');
  const badOrigin=await fetch(API+'?event=culinary-battle-2026',{
    headers:{Origin:'https://other.example'},signal:AbortSignal.timeout(20000)
  });
  assert.equal(badOrigin.status,403);
  process.stdout.write('PASS: live GET 26/19, code denial, CORS and no assignment leaks; status '+state.status+'; remaining '+state.remaining+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
