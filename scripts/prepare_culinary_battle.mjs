#!/usr/bin/env node
// Prepare 26 individual cryptographic codes and 19 unassigned dishes offline.
// Never commit secrets, code digests, private SQL, or generated participant files.
// Preferred: BATTLE_PEPPER=<32+ chars> node scripts/prepare_culinary_battle.mjs \
//   --output /secure/battle-output --slug culinary-battle-2026
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';
import { randomUUID, randomInt, createHmac } from 'node:crypto';

function die(message) { console.error(message); process.exit(1); }
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,all)=>{
  if(value.startsWith('--')) pairs.push([value.slice(2),all[index+1]||'']);
  return pairs;
},[]));
if (!args.output || !args.slug || !/^[a-z0-9-]{4,80}$/.test(args.slug)) {
  die('Required: --output PRIVATE_DIR --slug EVENT_SLUG [--teams FILE --dishes FILE]');
}
const pepper=process.env.BATTLE_PEPPER||'';
if(pepper.length<32) die('BATTLE_PEPPER must have at least 32 unpredictable characters.');
const root=resolve(process.cwd()), output=resolve(args.output), rel=relative(root,output);
if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel))){
  die('Output must be outside the public Git repository.');
}
const lines=(file)=>readFileSync(resolve(file),'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const fixture=JSON.parse(readFileSync(resolve('culinary-battle/demo-data.json'),'utf8'));
if(fixture.demo!==true) die('Unrecognized fixture format.');
let teams, dishes;
if(args.teams&&args.dishes){
  teams=lines(args.teams).map((line)=>{
    const p=line.split('|').map(x=>x.trim());
    if(p.length!==2) die('Expected team name|catalog_slug per line.');
    return {name:p[0],slug:p[1],id:randomUUID()};
  });
  dishes=lines(args.dishes).map(title=>({title,id:randomUUID()}));
}else if(!args.teams&&!args.dishes){
  const roster=JSON.parse(readFileSync(resolve('data/toses.json'),'utf8'));
  teams=roster.map(t=>({name:t.name,slug:t.slug,id:randomUUID()}));
  dishes=fixture.dishes.map(d=>({title:d.title,id:randomUUID()}));
  // Require exact match to the approved public contest snapshot.
  if(JSON.stringify(roster.map(t=>[t.slug,t.name]).sort((a,b)=>a[0].localeCompare(b[0])))!==
    JSON.stringify(fixture.teams.map(t=>[t.tos_slug,t.name]).sort((a,b)=>a[0].localeCompare(b[0])))) {
    die('Catalog roster changed: review the 26 teams before provisioning.');
  }
}else die('Provide both --teams and --dishes, or neither.');
if(teams.length!==26||dishes.length!==19) die('Expected 26 teams and exactly 19 dishes.');
function unique(values,label){
  if(new Set(values.map(x=>String(x).toLocaleLowerCase('ru').replace(/ё/g,'е').trim())).size!==values.length)
    die('Duplicate '+label);
}
for(const t of teams){
  if(typeof t.name!=='string'||t.name.length<2||t.name.length>160||
     !/^[a-z0-9-]{2,100}$/.test(t.slug)) die('Invalid team or catalog slug.');
}
for(const d of dishes){
  if(typeof d.title!=='string'||d.title.length<2||d.title.length>160) die('Invalid dish.');
}
unique(teams.map(t=>t.name),'team names');
unique(teams.map(t=>t.slug),'team slugs');
unique(dishes.map(d=>d.title),'dishes');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(){
  return Array.from({length:24},()=>alphabet[randomInt(alphabet.length)])
    .join('').match(/.{4}/g).join('-');
}
const codes=new Set();
for(const t of teams){
  do{t.code=generateCode();}while(codes.has(t.code));
  codes.add(t.code);
  t.digest=createHmac('sha256',pepper)
    .update('code:'+t.code.replaceAll('-','')).digest('hex');
}
const eventId=randomUUID(), q=(s)=>"'"+String(s).replaceAll("'","''")+"'";
const sql=[
 '-- PRIVATE. Apply only to a new isolated Supabase battle project after migration.',
 '-- NO dish allocations are created. The database assigns a free dish when a team first draws.',
 'begin;',
 `insert into public.battle_events(id,slug,title,status) values(${q(eventId)},${q(args.slug)},'Кулинарный батл ТОС БГО','draft');`,
 ...teams.map(t=>`insert into public.battle_teams(id,event_id,tos_slug,name,code_digest) values(${q(t.id)},${q(eventId)},${q(t.slug)},${q(t.name)},${q(t.digest)});`),
 ...dishes.map(d=>`insert into public.battle_dishes(id,event_id,title) values(${q(d.id)},${q(eventId)},${q(d.title)});`),
 `update public.battle_events set status='ready' where id=${q(eventId)};`,
 'commit;',
 ''
].join('\n');
const csv=(v)=>'"'+String(v).replaceAll('"','""')+'"';
const participantCsv=['ТОС;Код;Каталог',...teams.map(t=>[t.name,t.code,t.slug].map(csv).join(';'))].join('\n')+'\n';
const querySql=`-- PRIVATE, for authorized organizer only.
select t.name as tos,d.title as dish,a.revealed_at
from public.battle_assignments a
join public.battle_teams t on t.event_id=a.event_id and t.id=a.team_id
join public.battle_dishes d on d.event_id=a.event_id and d.id=a.dish_id
join public.battle_events e on e.id=a.event_id
where e.slug=${q(args.slug)} order by a.revealed_at;
`;
mkdirSync(output,{recursive:true,mode:0o700});
writeFileSync(join(output,'seed-private.sql'),sql,{flag:'wx',mode:0o600});
writeFileSync(join(output,'codes-private.csv'),'\uFEFF'+participantCsv,{flag:'wx',mode:0o600});
writeFileSync(join(output,'organizer-results.sql'),querySql,{flag:'wx',mode:0o600});
console.log('Prepared 26 unique private codes and 19 unassigned dishes.');
console.log('Event is READY, not OPEN. Distribution begins only after real launch.');
