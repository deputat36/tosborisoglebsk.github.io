const assert = require('node:assert/strict');
const fs = require('node:fs');
const { renderTosProfile, LABELS } = require('./lib/tos_profiles');
const data = JSON.parse(fs.readFileSync('data/tos_profiles.json','utf8'));
const toses = JSON.parse(fs.readFileSync('data/toses.json','utf8')).filter(t => t.status !== 'draft');
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && value <= data.checked_at;
assert.equal(data.schema_version,1);
assert.equal(data.profiles.length,toses.length);
assert.equal(new Set(data.profiles.map(p => p.tos_slug)).size,toses.length);
const sources = new Map();
for (const source of data.sources) {
  assert(!sources.has(source.id),`duplicate source ${source.id}`);
  const url = new URL(source.url);
  assert.equal(url.protocol,'https:');
  assert(!/tosborisoglebsk\.(ru|github\.io)$/.test(url.hostname),'portal cannot corroborate its own facts');
  assert(source.published_at ? iso(source.published_at) : Boolean(source.date_note),`invalid/future or unexplained missing source date ${source.id}`);
  assert(iso(source.checked_at),`missing source review date ${source.id}`);
  assert(source.title && source.publisher);
  sources.set(source.id,source);
}
let count = 0;
for (const tos of toses) {
  const profile = data.profiles.find(p => p.tos_slug === tos.slug);
  assert(profile,`missing profile ${tos.slug}`);
  assert(iso(profile.checked_at));
  assert(profile.clarifications.length > 0,'record the limits of research');
  const ids = new Set();
  for (const fact of profile.facts) {
    assert(!ids.has(fact.id) && fact.id.startsWith(`${tos.slug}-`)); ids.add(fact.id);
    assert(LABELS[fact.kind] && fact.period && fact.title && fact.text);
    assert(fact.source_ids.length > 0,`unsourced fact ${fact.id}`);
    for (const id of fact.source_ids) assert(sources.has(id),`unknown source ${id}`);
    count++;
  }
  const html = fs.readFileSync(`tos/${tos.slug}/index.html`,'utf8');
  assert.equal((html.match(/data-tos-profile=/g)||[]).length,1);
  assert.equal((html.match(/data-profile-fact=/g)||[]).length,profile.facts.length);
  assert(html.includes(renderTosProfile(tos,data)),`stale profile HTML ${tos.slug}`);
  assert(html.includes('Сведения относятся к указанным годам'));
  assert(html.includes('href="#tos-profile"'), 'history is reachable from the first screen');
}
for(const slug of ['ivanovka','podstepki']) assert.equal(data.profiles.find(p=>p.tos_slug===slug).facts.find(f=>f.id.endsWith('-competition')).kind,'award','competition selection is not completion');
for(const slug of ['dzerzhinskogo','pobeda']) assert.equal(data.profiles.find(p=>p.tos_slug===slug).facts.length,0,'do not invent activity without sources');
const sample={sources:[{id:'bad',url:'javascript:alert(1)',publisher:'X',title:'Y',published_at:'2026-01-01'}],profiles:[{tos_slug:'x',checked_at:'2026-10-15',topics:[],facts:[{id:'x-1',period:'2026',kind:'reported',title:'<img onerror=alert(1)>',text:'<script>x</script>',source_ids:['bad']}],clarifications:[]}]};
const html=renderTosProfile({slug:'x'},sample);
assert(!html.includes('javascript:') && !html.includes('<img onerror') && !html.includes('<script>'));
console.log(`TOS profiles OK: ${toses.length} cards, ${sources.size} sources, ${count} dated facts; unknowns, attribution and safe HTML checked`);
