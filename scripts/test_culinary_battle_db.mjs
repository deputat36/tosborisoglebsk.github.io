#!/usr/bin/env node
// Integration test ONLY for an empty throwaway PostgreSQL database.
// Explicit opt-in BATTLE_DB_TEST_MODE=1 prevents accidental production operation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runAsync=promisify(execFile);
const root=process.cwd();
if(process.env.BATTLE_DB_TEST_MODE!=='1') throw Error('Only in disposable database: set BATTLE_DB_TEST_MODE=1');
if(process.env.BATTLE_DB_TEST_DB_NAME!=='culinary_ci_disposable') throw Error('Use dedicated DB named culinary_ci_disposable');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'culinary-db-check-'));
const psql=['-X','-At','-v','ON_ERROR_STOP=1'];
const env={...process.env,PGDATABASE:'culinary_ci_disposable'};
function run(query){return execFileSync('psql',[...psql,'-c',query],{env,encoding:'utf8'}).trim();}
function file(filename){execFileSync('psql',[...psql,'-f',filename],{env,stdio:'pipe'});}
const client=(n)=>String(n).toString(16).padStart(64,'0');
const reveal=(team,clientN,digest=team.digest)=>'set role service_role; select public.battle_reveal('+
  "'test-battle-2026',"+ "'"+team.id+"'::uuid,'"+digest+"','"+client(clientN)+"');";
function parse(raw){return JSON.parse(raw.trim().split('\n').pop());}
try{
  assert.equal(run('select current_database()'),'culinary_ci_disposable');
  assert.equal(run("select count(*) from information_schema.tables where table_schema='public' and table_name like 'battle_%'"),'0');
  run('create role service_role bypassrls; create role anon; create role authenticated;');
  file(path.join(root,'supabase/migrations/20261106140000_culinary_battle.sql'));
  const dir=path.join(temp,'private');
  execFileSync(process.execPath,[
    'scripts/prepare_culinary_battle.mjs','--output',dir,'--slug','test-battle-2026'
  ],{cwd:root,env:{...env,BATTLE_PEPPER:'ci-only-synthetic-pepper-not-for-actual-event-123'},stdio:'pipe'});
  file(path.join(dir,'seed-private.sql'));
  const initial=run("select status||'|'||(select count(*) from public.battle_teams)||'|'||(select count(*) from public.battle_dishes)||'|'||(select count(*) from public.battle_assignments) from public.battle_events where slug='test-battle-2026'");
  assert.equal(initial,'ready|26|19|0');
  // Pilot must give the first *real* meal only to Uyutny, then unlock others.
  run("update public.battle_events set status='pilot',pilot_tos_slug='uyutnyy' where slug='test-battle-2026' and status='ready'");
  const rows=run('select id,code_digest,tos_slug from public.battle_teams order by name')
    .split('\\n').map(line=>{const [id,digest,slug]=line.split('|');return{id,digest,slug};});
  assert.equal(rows.length,26);
  const uyutnyy=rows.find(team=>team.slug==='uyutnyy');
  assert(uyutnyy,'Uyutny pilot team should exist');
  const others=rows.filter(team=>team.slug!=='uyutnyy');
  assert.equal(others.length,25);

  const badPilot=parse(run(reveal(uyutnyy,1,'f'.repeat(64))));
  assert.equal(badPilot.error,'invalid_credentials');
  const blocked=parse(run(reveal(others[0],2)));
  assert.equal(blocked.error,'pilot_only');
  assert.equal(run('select count(*) from public.battle_assignments'),'0');
  const first=parse(run(reveal(uyutnyy,3)));
  assert.equal(first.first_open,true);
  assert.equal(first.remaining,18);
  const repeat=parse(run(reveal(uyutnyy,3)));
  assert.equal(repeat.first_open,false);
  assert.equal(repeat.dish_name,first.dish_name);
  assert.equal(run('select count(*) from public.battle_assignments'),'1');

  run("update public.battle_events set status='open',pilot_tos_slug=null where slug='test-battle-2026' and status='pilot'");
  const dishes=new Set([first.dish_name]);
  for(let i=0;i<17;i++){
    const answer=parse(run(reveal(others[i],i+4)));
    assert.equal(answer.first_open,true);
    assert.ok(answer.dish_name);
    assert.equal(answer.remaining,17-i);
    assert.ok(!dishes.has(answer.dish_name));
    dishes.add(answer.dish_name);
  }
  assert.equal(run("select status from public.battle_events where slug='test-battle-2026'"),'open');
  // Race two separate connections for the exact LAST dish.
  const race=await Promise.all([17,18].map(async(i)=>{
    const {stdout}=await runAsync('psql',[...psql,'-c',reveal(others[i],i+4)],{env,encoding:'utf8'});
    return parse(stdout);
  }));
  assert.equal(race.filter(v=>v.first_open===true).length,1);
  assert.equal(race.filter(v=>v.error==='sold_out').length,1);
  dishes.add(race.find(v=>v.first_open).dish_name);
  assert.equal(dishes.size,19);
  assert.equal(run("select status from public.battle_events where slug='test-battle-2026'"),'closed');
  assert.equal(run('select count(*)||\\'|\\'||count(distinct dish_id)||\\'|\\'||count(distinct team_id) from public.battle_assignments'),'19|19|19');
  for(let i=19;i<others.length;i++)assert.equal(parse(run(reveal(others[i],i+4))).error,'sold_out');
  const after=parse(run(reveal(uyutnyy,3)));
  assert.equal(after.first_open,false);
  assert.equal(after.dish_name,first.dish_name);
  assert.equal(run('select count(*) from public.battle_assignments'),'19');
  // Public roles must not read team code digests, assignments or action logs.
  let blocked=false;
  try{run('set role anon; select * from public.battle_assignments;');}
  catch{blocked=true;}
  assert.equal(blocked,true);
  blocked=false;
  try{run('set role authenticated; select code_digest from public.battle_teams;');}
  catch{blocked=true;}
  assert.equal(blocked,true);
  console.log('PASS PostgreSQL: Uyutny-only pilot, unlock 25 teams, 19 atomic draws, last-dish race, closure, repeat, grants');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
