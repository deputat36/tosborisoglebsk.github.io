const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('../assets/js/materials-core');
const curated = JSON.parse(fs.readFileSync('data/materials.json'));
const articles = JSON.parse(fs.readFileSync('data/articles.json'));
const original = JSON.stringify({ curated, articles });
const list = api.buildCatalog(curated, articles);
const urls = new Set(list.map(item => item.url));
assert.equal(urls.size, list.length, 'one card per destination');
for (const article of articles.filter(item => !['draft', 'archived'].includes(item.status))) {
  assert(urls.has(`/materials/${article.id}/`), `article is discoverable: ${article.id}`);
}
assert.equal(JSON.stringify({ curated, articles }), original, 'catalog assembly must not mutate sources');
assert.equal(list.filter(item => item.id === 'community-resource-map').length, 1, 'curated/article overlap is one card');
assert.equal(list.find(item => item.id === 'community-resource-map').kind, 'article');
assert(list.every(item => api.TOPICS[item.topic]), 'every card has a usable topic');
const results = q => list.filter(item => api.matches(item, { q })).map(item => item.id);
assert(results('обращение').includes('resident-request-to-result'));
assert(results('проект, смета').includes('simple-project-budget'), 'all query words and punctuation');
assert.equal(list.filter(item => api.matches(item, { q: 'смета' })).sort((a, b) => api.relevance(b, 'смета') - api.relevance(a, 'смета'))[0].id, 'simple-project-budget', 'the direct budget guide precedes passing mentions');
assert.deepEqual(results('ОТЧЁТ'), results('отчет'), 'case and ё/е must not hide results');
assert(results('неденежный').includes('community-resource-map'), 'search includes article sections');
assert.equal(results('несуществующий-запрос-78128').length, 0);
assert(list.filter(item => api.matches(item, { topic: 'projects' })).every(item => item.topic === 'projects'));
const sample = api.buildCatalog([
  { id: 'same', title: 'Первый вариант', url: '/materials/example', category: 'Неизвестная тема', tags: [] },
  { id: 'duplicate', title: 'Второй вариант', url: '/materials/example/', category: 'Неизвестная тема' },
  { id: 'draft', title: 'Черновик', url: '/draft/', status: 'draft' },
  { id: 'archived', title: 'Архив', url: '/archived/', status: 'archived' },
  ...['javascript:alert(1)', '//example.org/path', '/\\example.org', 'data:text/html,test'].map((url, index) => ({ id: `bad-${index}`, title: 'Опасная ссылка', url }))
], [{ id: '../unsafe', title: 'Плохой идентификатор' }]);
assert.equal(sample.length, 1, 'drafts, archived entries, unsafe URLs and duplicate routes stay out');
assert.equal(sample[0].topic, 'other', 'a new category stays discoverable');
assert(api.matches(sample[0], { q: 'второй' }), 'merged search keeps alternate metadata');
const html = api.render({ id: 'safe', title: '<script>alert(1)</script>', description: '"<img src=x onerror=alert(1)>', url: '/safe/', audience: '<person>', search: '" injected', topic: 'start' });
assert(!html.includes('<script>') && !html.includes('<img') && !html.includes('<person>'));
assert.equal(api.render({ url: 'javascript:alert(1)' }), '');
console.log(`Materials catalog OK: ${list.length} unique pages, all articles, full-text search, safe rendering and source immutability`);
