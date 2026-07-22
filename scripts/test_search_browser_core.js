const assert = require('assert');
const SearchCore = require('../assets/js/search-browser-core');

const pages = [
  { title: 'ТОС Миролюбие получил грант', description: 'Официальный протокол', section: 'Новости', path: 'news/grant/index.html', search_group: 'news', content_origin: 'verified' },
  { title: 'Идея общественного стенда', description: 'Стартовая идея для обсуждения', section: 'Проекты', path: 'projects/stand/index.html', search_group: 'projects', content_origin: 'starter' },
  { title: 'Как создать ТОС', description: 'Пошаговая инструкция', section: 'Создание ТОС', path: 'create-tos/index.html', search_group: 'guides', content_origin: 'reference' },
  { title: 'Ёлки для территории', description: 'Редакционный материал', section: 'Материалы', path: 'materials/elki/index.html', search_group: 'materials', content_origin: 'editorial' }
];

assert.strictEqual(SearchCore.normalizeText('  Ёлки   ТОС '), 'елки тос');
assert.strictEqual(SearchCore.normalizeOrigin('unknown'), '');
assert.strictEqual(SearchCore.normalizeSort('bad'), 'relevance');
assert(SearchCore.scorePage(pages[0], 'грант') > SearchCore.scorePage(pages[0], 'протокол'));

assert.deepStrictEqual(
  SearchCore.filterPages(pages, { q: 'ёлки', type: '', origin: '', sort: 'relevance' }).map((page) => page.path),
  ['materials/elki/index.html']
);
assert.deepStrictEqual(
  SearchCore.filterPages(pages, { q: '', type: 'projects', origin: 'starter', sort: 'title' }).map((page) => page.path),
  ['projects/stand/index.html']
);
assert.deepStrictEqual(SearchCore.filterPages(pages, { q: 'несуществующее', sort: 'relevance' }), []);

const counts = SearchCore.countOrigins(pages);
assert.deepStrictEqual(counts, { reference: 1, verified: 1, editorial: 1, starter: 1, request: 0 });
assert.deepStrictEqual(SearchCore.availableGroups(pages).sort(), ['guides', 'materials', 'news', 'projects']);

console.log('Search browser core self-test OK');
