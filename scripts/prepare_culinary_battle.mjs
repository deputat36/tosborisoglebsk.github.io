#!/usr/bin/env node
// Offline provisioning. Never commit input lists, generated SQL or plaintext codes.
// Example: BATTLE_PEPPER=... node scripts/prepare_culinary_battle.mjs \
//   --teams /secure/teams.txt --dishes /secure/dishes.txt \
//   --output /secure/battle-output --slug culinary-battle-2026
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';
import { randomUUID, randomInt, createHmac } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => {
  if (value.startsWith('--')) rows.push([value.slice(2), all[index + 1] || '']);
  return rows;
}, []));
function die(message) { console.error(message); process.exit(1); }
if (!args.teams || !args.dishes || !args.output || !args.slug) {
  die('Required: --teams FILE --dishes FILE --output PRIVATE_DIR --slug EVENT_SLUG');
}
if (!/^[a-z0-9-]{4,80}$/.test(args.slug)) die('Invalid event slug.');
const pepper = process.env.BATTLE_PEPPER || '';
if (pepper.length < 32) die('BATTLE_PEPPER needs at least 32 unpredictable characters.');
const root = resolve(process.cwd());
const output = resolve(args.output);
const withinRepo = relative(root, output);
if (withinRepo === '' || (!withinRepo.startsWith('..' + sep) && withinRepo !== '..' && !isAbsolute(withinRepo))) {
  die('Output must be OUTSIDE the public repository.');
}
function lines(filename) {
  return readFileSync(resolve(filename), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}
const teamLines = lines(args.teams);
const dishLines = lines(args.dishes);
if (teamLines.length !== 18 || dishLines.length !== 18) die('Exactly 18 teams and 18 dishes are required.');
const teams = teamLines.map((line) => {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length > 2 || parts[0].length < 2 || parts[0].length > 160
     || (parts[1] && !/^[a-z0-9-]{2,100}$/.test(parts[1]))) die('Invalid team entry.');
  return { name: parts[0], slug: parts[1] || null, id: randomUUID() };
});
const dishes = dishLines.map((title) => {
  if (title.length < 2 || title.length > 160) die('Invalid dish entry.');
  return { title, id: randomUUID() };
});
function ensureUnique(values, label) {
  if (new Set(values.map((v) => v.toLocaleLowerCase('ru').replace(/ё/g, 'е'))).size !== values.length) {
    die('Duplicate ' + label + '.');
  }
}
ensureUnique(teams.map((t) => t.name), 'teams');
ensureUnique(dishes.map((d) => d.title), 'dishes');
ensureUnique(teams.filter((t) => t.slug).map((t) => t.slug), 'TOS slugs');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  const chars = Array.from({ length: 24 }, () => alphabet[randomInt(alphabet.length)]);
  return chars.join('').match(/.{4}/g).join('-');
}
const uniqueCodes = new Set();
teams.forEach((t) => {
  do { t.code = generateCode(); } while (uniqueCodes.has(t.code));
  uniqueCodes.add(t.code);
  t.digest = createHmac('sha256', pepper).update('code:' + t.code.replace(/-/g, '')).digest('hex');
});
// Cryptographically secure, unbiased Fisher-Yates shuffle.
for (let i = dishes.length - 1; i > 0; i -= 1) {
  const j = randomInt(i + 1);
  [dishes[i], dishes[j]] = [dishes[j], dishes[i]];
}
const eventId = randomUUID();
const sqlQuote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const sql = [
  '-- PRIVATE provisioning script for dedicated Supabase project; NOT for public Git.',
  'begin;',
  `insert into public.battle_events(id,slug,title,status) values (${sqlQuote(eventId)},${sqlQuote(args.slug)},'Кулинарный батл ТОС БГО','draft');`,
  ...teams.map((t) =>
    `insert into public.battle_teams(id,event_id,tos_slug,name,code_digest) values(${sqlQuote(t.id)},${sqlQuote(eventId)},${t.slug ? sqlQuote(t.slug) : 'null'},${sqlQuote(t.name)},${sqlQuote(t.digest)});`),
  ...dishes.map((d) =>
    `insert into public.battle_dishes(id,event_id,title) values(${sqlQuote(d.id)},${sqlQuote(eventId)},${sqlQuote(d.title)});`),
  ...teams.map((t, i) =>
    `insert into public.battle_assignments(event_id,team_id,dish_id) values(${sqlQuote(eventId)},${sqlQuote(t.id)},${sqlQuote(dishes[i].id)});`),
  `update public.battle_events set status='ready' where id=${sqlQuote(eventId)};`,
  'commit;',
  ''
].join('\n');
const csvValue = (s) => '"' + String(s).replaceAll('"', '""') + '"';
const codesCsv = ['ТОС;Код', ...teams.map((t) => [t.name, t.code].map(csvValue).join(';'))].join('\n') + '\n';
const assignmentsCsv = ['ТОС;Блюдо', ...teams.map((t, i) => [t.name, dishes[i].title].map(csvValue).join(';'))].join('\n') + '\n';
mkdirSync(output, { recursive: true, mode: 0o700 });
writeFileSync(join(output, 'seed-private.sql'), sql, { flag: 'wx', mode: 0o600 });
writeFileSync(join(output, 'codes-private.csv'), '\uFEFF' + codesCsv, { flag: 'wx', mode: 0o600 });
writeFileSync(join(output, 'assignments-private.csv'), '\uFEFF' + assignmentsCsv, { flag: 'wx', mode: 0o600 });
console.log('Prepared 18 unique assignments and 18 codes in a private directory outside Git.');
console.log('Event status after seed: ready. Open it only after API verification.');
