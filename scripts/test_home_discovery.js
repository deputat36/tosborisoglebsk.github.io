const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../assets/js/home-discovery-core.js');
const ROOT = process.cwd();
const toses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'toses.json'), 'utf8'));
// Fixed editorial fixtures keep temporal assertions independent of live publications.
const events = [
  { date: '2026-08-01', status: 'published', title: 'Встреча' },
  { date: '2026-07-01', status: 'published', title: 'Прошедшее' },
  { date: '2026-07-18', status: 'draft', title: 'Черновик' }
];
const news = [
  { date: '2026-06-24', status: 'published', content_origin: 'editorial' },
  { date: '2026-07-16', status: 'published', content_origin: 'request' },
  { date: '2026-07-15', status: 'draft', content_origin: 'editorial' },
  { date: '2026-08-01', status: 'published', content_origin: 'editorial' }
];
const health = { catalog: { total_tos: 24 } };
assert.strictEqual(core.normalize('Подстёпки'), 'подстепки');
assert.strictEqual(core.searchToses(toses, 'п').length, 0);
assert(core.searchToses(toses, 'Подстепки').some((item) => item.slug === 'podstepki'));
assert(core.searchToses(toses, 'Чигорак').length >= 4);
assert.strictEqual(core.searchToses([{ name: 'Черновик', status: 'draft', slug: 'draft' }], 'черновик').length, 0);
const overview = core.buildCurrentOverview({ events, news, health, now: new Date('2026-07-17T12:00:00+03:00'), freshDays: 30 });
assert(overview.upcoming.length > 0);
assert.strictEqual(overview.upcoming[0].date, '2026-08-01');
assert.strictEqual(overview.freshNews.length, 1);
assert(overview.latestNews && overview.latestNews.date === '2026-06-24');
assert.strictEqual(overview.catalog.total_tos, 24);
const midnight=core.buildCurrentOverview({now:new Date('2026-07-17T21:01:00Z'),news:[{date:'2026-07-18',status:'published',title:'Новая публикация'}]});
assert.equal(midnight.freshNews.length,1,'the homepage date changes at midnight in Moscow, not at the browser timezone boundary');
const opportunity={id:'test-call',status:'published',call_status:'announced',source:'https://example.test/call',source_checked_at:'2026-07-17',deadline_at:'2026-07-19T00:00:00+03:00'};
assert.equal(core.buildCurrentOverview({grants:[opportunity],now:new Date('2026-07-18T10:00:00Z')}).opportunities.length,1);
assert.equal(core.buildCurrentOverview({grants:[opportunity],now:new Date('2026-07-19T10:00:00Z')}).opportunities.length,0,'expired calls leave the homepage overview');
console.log(`Home discovery OK: ${toses.length} cards, ${overview.upcoming.length} upcoming items, ${overview.freshNews.length} fresh news`);
