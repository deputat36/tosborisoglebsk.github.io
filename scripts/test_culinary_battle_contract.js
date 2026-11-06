#!/usr/bin/env node
// Safe synthetic 18x18 preparation check. Does not need Supabase or real names.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-battle-test-'));
const repo = path.resolve(__dirname, '..');
try {
  const teams = path.join(work, 'teams.txt');
  const dishes = path.join(work, 'dishes.txt');
  const output = path.join(work, 'private');
  fs.writeFileSync(teams, Array.from({ length: 18 }, (_, i) => 'Тестовый ТОС ' + (i + 1)).join('\n'));
  fs.writeFileSync(dishes, Array.from({ length: 18 }, (_, i) => 'Тестовое блюдо ' + (i + 1)).join('\n'));
  const result = execFileSync(process.execPath, [
    'scripts/prepare_culinary_battle.mjs', '--teams', teams, '--dishes', dishes,
    '--output', output, '--slug', 'test-battle-2026'
  ], { cwd: repo, env: { ...process.env, BATTLE_PEPPER: 'synthetic-check-only-very-long-secret-not-live' }, encoding: 'utf8' });
  assert.match(result, /18 unique assignments/);
  const seed = fs.readFileSync(path.join(output, 'seed-private.sql'), 'utf8');
  const codes = fs.readFileSync(path.join(output, 'codes-private.csv'), 'utf8').replace(/^\uFEFF/, '');
  const assignments = fs.readFileSync(path.join(output, 'assignments-private.csv'), 'utf8').replace(/^\uFEFF/, '');
  const rows = codes.trim().split('\n').slice(1);
  assert.equal(rows.length, 18);
  assert.equal(assignments.trim().split('\n').slice(1).length, 18);
  const tokens = rows.map((row) => row.split(';')[1].replaceAll('"', '').replaceAll('-', ''));
  assert.equal(new Set(tokens).size, 18);
  for (const code of tokens) {
    assert.match(code, /^[A-HJ-NP-Z2-9]{24}$/);
    assert.ok(!seed.includes(code), 'No plaintext participation code may appear in SQL');
  }
  assert.equal((seed.match(/insert into public\.battle_assignments/g) || []).length, 18);
  assert.equal((seed.match(/insert into public\.battle_teams/g) || []).length, 18);
  assert.equal((seed.match(/insert into public\.battle_dishes/g) || []).length, 18);
  assert.ok(seed.includes("set status='ready'"));
  const html = fs.readFileSync(path.join(repo, 'culinary-battle/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(repo, 'assets/js/culinary-battle.js'), 'utf8');
  const sql = fs.readFileSync(path.join(repo, 'supabase/migrations/20261106140000_culinary_battle.sql'), 'utf8');
  assert.match(html, /assets\/js\/culinary-battle\.js/);
  assert.match(html, /assets\/css\/styles\.css/);
  assert.match(html, /assets\/img\/logo\.svg/);
  assert.ok(!js.includes('SERVICE_ROLE_KEY'));
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /canvas\.toDataURL\('image\/png'\)/);
  assert.match(sql, /unique \(event_id, dish_id\)/);
  assert.match(sql, /primary key \(event_id, team_id\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /revoke all on public\.battle_events/);
  assert.match(sql, /security definer/);
  // Explicitly synthetic preview data: no actual teams, server codes, or results.
  const demo = JSON.parse(fs.readFileSync(path.join(repo, 'culinary-battle/demo-data.json'), 'utf8'));
  assert.equal(demo.demo, true);
  assert.equal(demo.teams.length, 18);
  assert.equal(demo.dishes.length, 18);
  assert.equal(new Set(demo.teams.map((x) => x.id)).size, 18);
  assert.equal(new Set(demo.teams.map((x) => x.name.toLowerCase())).size, 18);
  assert.equal(new Set(demo.dishes.map((x) => x.title.toLowerCase())).size, 18);
  assert.ok(demo.teams.every((x, i) => x.id === 'demo-' + String(i + 1).padStart(2, '0')));
  assert.ok(demo.teams.every((x) => x.name.startsWith('Учебный ТОС')));
  assert.equal(new Set(demo.teams.map((_, i) => (i * 5 + 7) % 18)).size, 18);
  assert.match(js, /new URLSearchParams\(location\.search\)\.get\('demo'\)/);
  assert.match(js, /const data = isDemo \? demoPick\(\) : await request/);
  assert.match(js, /if \(isDemo\) \{/);
  assert.match(js, /ДЕМО · НЕ ДЛЯ БАТЛА/);
  assert.ok(!JSON.stringify(demo).includes('code_digest'));
  assert.ok(!JSON.stringify(demo).includes('revealed_at'));
  assert.ok(!JSON.stringify(demo).includes('SUPABASE_SERVICE_ROLE_KEY'));

  console.log('Synthetic 18x18 and static security contract: PASS');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
