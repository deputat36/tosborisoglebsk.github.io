#!/usr/bin/env node
// Static and synthetic checks for the 24-team / 19-dish scarce-draw event.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'tos-battle-24x19-'));
try{
  const demo=JSON.parse(fs.readFileSync(path.join(repo,'culinary-battle/demo-data.json'),'utf8'));
  const roster=JSON.parse(fs.readFileSync(path.join(repo,'data/toses.json'),'utf8'));
  assert.equal(demo.demo,true);
  assert.equal(roster.length,24);
  assert.equal(demo.teams.length,24);
  assert.equal(demo.dishes.length,19);
  assert.deepEqual(demo.teams.map(t=>[t.tos_slug,t.name]),roster.map(t=>[t.slug,t.name]));
  assert.deepEqual(demo.teams.map(t=>t.id),Array.from({length:24},(_,i)=>'demo-'+String(i+1).padStart(2,'0')));
  assert.equal(new Set(demo.teams.map(t=>t.name.toLowerCase())).size,24);
  assert.equal(new Set(demo.dishes.map(d=>d.title.toLowerCase())).size,19);
  assert.ok(demo.dishes.some(d=>d.title==='Хуплу'&&d.cuisine==='чувашская кухня'));
  const output=path.join(work,'private');
  const text=execFileSync(process.execPath,[
    'scripts/prepare_culinary_battle.mjs','--output',output,'--slug','test-battle-2026'
  ],{cwd:repo,env:{...process.env,BATTLE_PEPPER:'synthetic-check-only-not-a-live-secret-12345'},encoding:'utf8'});
  assert.match(text,/24 unique private codes and 19 unassigned dishes/);
  const sqlSeed=fs.readFileSync(path.join(output,'seed-private.sql'),'utf8');
  const codes=fs.readFileSync(path.join(output,'codes-private.csv'),'utf8').replace(/^\uFEFF/,'');
  const list=codes.trim().split(/\r?\n/).slice(1);
  assert.equal(list.length,24);
  const tokens=list.map(row=>row.split(';')[1].replaceAll('"','').replaceAll('-',''));
  assert.equal(new Set(tokens).size,24);
  for(const token of tokens){
    assert.match(token,/^[A-HJ-NP-Z2-9]{24}$/);
    assert.ok(!sqlSeed.includes(token));
  }
  assert.equal((sqlSeed.match(/insert into public\.battle_teams/g)||[]).length,24);
  assert.equal((sqlSeed.match(/insert into public\.battle_dishes/g)||[]).length,19);
  assert.equal((sqlSeed.match(/insert into public\.battle_assignments/g)||[]).length,0);
  assert.ok(sqlSeed.includes("set status='ready'"));
  assert.ok(fs.existsSync(path.join(output,'organizer-results.sql')));
  const sql=fs.readFileSync(path.join(repo,'supabase/migrations/20261106140000_culinary_battle.sql'),'utf8');
  const js=fs.readFileSync(path.join(repo,'assets/js/culinary-battle.js'),'utf8');
  const html=fs.readFileSync(path.join(repo,'culinary-battle/index.html'),'utf8');
  const fn=fs.readFileSync(path.join(repo,'supabase/functions/culinary-battle/index.ts'),'utf8');
  assert.match(sql,/v_teams<>24 or v_dishes<>19 or v_assignments<>0/);
  assert.match(sql,/order by gen_random_uuid\(\) limit 1/);
  assert.match(sql,/for update/);
  assert.match(sql,/v_remaining=0/);
  assert.match(sql,/primary key\(event_id,team_id\)/);
  assert.match(sql,/unique\(event_id,dish_id\)/);
  assert.equal((sql.match(/^begin;$/gm)||[]).length,1);
  assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
  assert.match(sql,/security invoker/);
  assert.ok(!sql.includes('security definer'));
  for(const table of ['battle_events','battle_teams','battle_dishes','battle_assignments','battle_actions','battle_rate_limits']){
    assert.ok(sql.includes('alter table public.'+table+' enable row level security;'));
  }
  assert.match(sql,/revoke all on function public\.battle_reveal/);
  assert.match(fn,/remaining: Math\.max\(0, 19 - assignments\.length\)/);
  assert.match(js,/teams\.length === 24/);
  assert.match(js,/free\[secureDemoIndex\(free\.length\)\]/);
  assert.match(js,/getDemoAssignments/);
  assert.match(js,/sold_out/);
  assert.ok(!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.match(html,/24 ТОСа\. 19 блюд/);
  assert.match(js,/canvas\.toDataURL\('image\/png'\)/);
  assert.ok(!JSON.stringify(demo).includes('code_digest'));
  assert.ok(!JSON.stringify(demo).includes('SUPABASE_SERVICE_ROLE_KEY'));
  console.log('24 catalog teams / 19 distinct dishes / 24 secret codes: PASS');
} finally {
  fs.rmSync(work,{recursive:true,force:true});
}
