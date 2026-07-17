const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../assets/js/home-discovery-core.js');

const ROOT = process.cwd();
const toses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'toses.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'events.json'), 'utf8'));
const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news.json'), 'utf8'));
const health = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site_health.json'), 'utf8'));

assert.strictEqual(core.normalize('Подстёпки'), 'подстепки');
assert.strictEqual(core.searchToses(toses, 'п').length, 0, 'one-character queries must not search');
assert(core.searchToses(toses, 'Подстепки').some((item) => item.slug === 'podstepki'), 'ё normalization must find Podstepki');
assert(core.searchToses(toses, 'Чигорак').length >= 4, 'location search must return published Chigorak cards');
assert.strictEqual(core.searchToses([{ name: 'Черновик', status: 'draft', slug: 'draft' }], 'черновик').length, 0, 'draft cards must stay hidden');

const overview = core.buildCurrentOverview({
  events,
  news,
  health,
  now: new Date('2026-07-17T12:00:00+03:00'),
  freshDays: 30
});
assert(overview.upcoming.length > 0, 'upcoming editorial dates must be available');
assert.strictEqual(overview.upcoming[0].date, '2026-08-01', 'past events must not appear before the next date');
assert.strictEqual(overview.freshNews.length, 0, 'stale news must not be presented as fresh');
assert(overview.latestNews && overview.latestNews.date === '2026-05-23', 'latest published news must remain visible as context');
assert.strictEqual(overview.catalog.total_tos, 24, 'catalog metrics must come from site health');

console.log(`Home discovery OK: ${toses.length} cards, ${overview.upcoming.length} upcoming items, ${overview.freshNews.length} fresh news`);
