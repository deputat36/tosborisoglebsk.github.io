const assert = require('assert');
const core = require('../assets/js/grants-core');
const grants = require('../data/grants.json');
const events = require('../data/events.json');
const news = require('../data/news.json');
const { grantCard, grantSummary } = require('../assets/js/grants');
const announcement = grants.find(row => row.id === 'obraz-tos-mini-2026-october');
assert(announcement, 'the sourced mini-grant announcement must exist');
const item = {...announcement, source_checked_at:'2026-10-15', call_status:'announced'};
const end = Date.parse('2026-10-19T20:59:59Z');
assert.strictEqual(core.deadline(item), end, 'deadline must preserve Moscow time');
assert.strictEqual(core.state(item, end), 'announced');
assert.strictEqual(core.state(item, end + 1), 'closed', 'a closed call must not remain current');
assert.strictEqual(core.current([item], end + 1).length, 0);
for (const change of [{source:''}, {source:'javascript:alert(1)'}, {source_checked_at:''}, {source_checked_at:'2026-02-30'}, {source_checked_at:'2026-10-20'}, {deadline_at:''}, {deadline_at:'2026-02-30T23:59:59+03:00'}, {call_status:''}, {status:'draft'}]) {
  assert.notStrictEqual(core.state({...item,...change}, Date.parse('2026-10-15T13:00:00Z')), 'announced', 'incomplete or draft data cannot advertise a current call');
}
assert.strictEqual(core.state({...item, deadline_at:'2027-03-01T23:59:59+03:00'}, Date.parse('2026-12-01T13:00:00Z')), 'unconfirmed', 'old announcements require rechecking');
const current = core.current(grants);
assert(current.every((call, index) => index === 0 || core.deadline(current[index-1]) <= core.deadline(call)), 'nearest deadline comes first');
const linkedAnnouncements = grants.filter(call => ['obraz-tos-mini-2026-october', 'obraz-individual-2026-october', 'fond-borisoglebsk-second-2026', 'sovet-kray-rodnoy-2026'].includes(call.id));
for (const call of linkedAnnouncements) {
  assert(events.some(event => event.source_url === call.source && event.date === (call.deadline_date || call.deadline_at.slice(0,10))), `${call.id}: calendar deadline missing`);
  assert(news.some(article => article.source_url === call.source && article.content_origin === 'verified'), `${call.id}: sourced news missing`);
}
const local = grants.find(row => row.id === 'fond-borisoglebsk-second-2026');
assert.equal(local.deadline_date, '2026-11-30');
assert.equal(core.state(local, Date.parse('2026-11-30T23:00:00+03:00')), 'announced');
assert.equal(core.state(local, Date.parse('2026-12-01T00:00:01+03:00')), 'closed');
assert(local.deadline.includes('время закрытия не указано'), 'the computed expiry must not become an invented public submission hour');
for (const rendered of [grantSummary(local), grantCard(local)]) {
  assert(rendered.includes('<dt>Срок</dt>') && rendered.includes('30 ноября 2026 года; время закрытия не указано'), 'the visible deadline must retain the source precision');
  assert(rendered.includes('<dt>Сумма / ресурс</dt>') && rendered.includes('До 100 000 рублей'), 'the support amount must remain clearly labelled');
  assert(!rendered.includes('00:00'), 'the internal expiry must not be presented as the submission time');
}
console.log('Current opportunities OK: Moscow deadlines, expiry, evidence, freshness, news and calendar');
