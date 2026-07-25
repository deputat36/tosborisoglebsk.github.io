const assert = require('assert');
const { coverageFor, coverageMap, coverageFromMap, originFor } = require('./lib/content_coverage');

const records = [
  { id: 'verified-news', status: 'published', tos_slug: 'alpha', content_origin: 'verified' },
  { id: 'editorial-news', tos_slug: 'alpha', content_origin: 'editorial' },
  { id: 'send-news-alpha-2026', status: 'published', tos_slug: 'alpha', content_origin: 'request' },
  { id: 'draft-news', status: 'draft', tos_slug: 'alpha', content_origin: 'verified' },
  { id: 'other-tos', status: 'published', tos_slug: 'beta', content_origin: 'verified' }
];

const alpha = coverageFor(records, 'alpha', 'news');
assert.deepStrictEqual(alpha, {
  all: 3,
  substantive: 2,
  requests: 1,
  origins: { verified: 1, editorial: 1, starter: 0, request: 1 }
});

const map = coverageMap(records, 'news');
assert.deepStrictEqual(coverageFromMap(map, 'alpha'), alpha);
assert.strictEqual(coverageFromMap(map, 'missing').all, 0);
assert.strictEqual(originFor({ id: 'send-news-example' }, 'news'), 'request');
assert.strictEqual(originFor({ id: 'event' }, 'events'), 'verified');

console.log('Content coverage self-test OK');
