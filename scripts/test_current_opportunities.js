const assert = require('assert');
const core = require('../assets/js/grants-core');
const grants = require('../data/grants.json');
const events = require('../data/events.json');
const news = require('../data/news.json');
const item = grants.find(row => row.id === 'obraz-tos-mini-2026-october');
assert(item, 'the sourced mini-grant announcement must exist');
const end = Date.parse('2026-10-19T20:59:59Z');
assert.strictEqual(core.deadline(item), end, 'deadline must preserve Moscow time');
assert.strictEqual(core.state(item, end), 'announced');
assert.strictEqual(core.state(item, end + 1), 'closed', 'a closed call must not remain current');
assert.strictEqual(core.current([item], end + 1).length, 0);
for (const change of [{source:''}, {source:'javascript:alert(1)'}, {source_checked_at:''}, {source_checked_at:'2026-02-30'}, {source_checked_at:'2026-10-20'}, {deadline_at:''}, {deadline_at:'2026-02-30T23:59:59+03:00'}, {call_status:''}, {status:'draft'}]) {
  assert.notStrictEqual(core.state({...item,...change}, Date.parse('2026-10-15T13:00:00Z')), 'announced', 'incomplete or draft data cannot advertise a current call');
}
assert.strictEqual(core.state({...item, deadline_at:'2027-03-01T23:59:59+03:00'}, Date.parse('2026-12-01T13:00:00Z')), 'unconfirmed', 'old announcements require rechecking');
const current = core.current(grants, Date.parse('2026-10-15T13:00:00Z'));
assert.strictEqual(current.length, 2);
assert(current[0].deadline_at < current[1].deadline_at, 'nearest deadline comes first');
for (const call of current) {
  assert(events.some(event => event.source_url === call.source && event.date === call.deadline_at.slice(0,10)), `${call.id}: calendar deadline missing`);
  assert(news.some(article => article.source_url === call.source && article.content_origin === 'verified'), `${call.id}: sourced news missing`);
}
console.log('Current opportunities OK: Moscow deadlines, expiry, evidence, freshness, news and calendar');
