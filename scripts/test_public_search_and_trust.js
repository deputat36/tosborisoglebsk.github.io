const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Catalog = require('../assets/js/tos-catalog-core');
const Home = require('../assets/js/home-discovery-core');

const now = Date.parse('2026-10-15T15:00:00Z');
const evidence = { source_ref: 'https://example.test/record', checked_at: '2026-10-01', verification_scope: ['location'], recheck_after: '2026-12-01' };
const status = item => Catalog.verificationStatus(item, { now });
const filled = { name: 'Тестовый ТОС', location: 'Территория', boundaries: 'Улица', chairperson: 'Председатель', founded: 2015, population: 100, phones: ['test'], emails: ['test'], social_links: ['test'], logo: 'test', description: 'Заполнено', updated_at: '2026-10-15' };
assert.strictEqual(status(filled), 'needs_review', 'a full recently edited card is not verified');
assert.strictEqual(status({ ...filled, verification_status: 'verified' }), 'needs_review', 'a label without evidence cannot verify a card');
assert.strictEqual(status({ ...filled, trust: evidence }), 'needs_review', 'a field check cannot approve the whole card automatically');
assert.strictEqual(status({ verification_status: 'partial', trust: evidence }), 'partial');
assert.strictEqual(status({ verification_status: 'verified', trust: evidence }), 'verified');
for (const change of [{ source_ref: '' }, { checked_at: '' }, { checked_at: '2026-02-30' }, { checked_at: '2026-11-01' }, { verification_scope: [] }]) {
  assert.strictEqual(status({ verification_status: 'verified', trust: { ...evidence, ...change } }), 'needs_review');
}
assert.strictEqual(status({ verification_status: 'partial', trust: { ...evidence, recheck_after: '2026-10-15' } }), 'partial', 'a check remains current through its recheck day');
assert.strictEqual(status({ verification_status: 'partial', trust: { ...evidence, recheck_after: '2026-10-14' } }), 'stale');
assert.strictEqual(status({ verification_status: 'partial', trust: { ...evidence, checked_at: '2025-01-01', recheck_after: '' } }), 'stale');
assert.strictEqual(status({ verification_status: 'partial', trust: { ...evidence, checked_at: '2025-01-01', recheck_after: '2026-02-30' } }), 'stale', 'an invalid recheck day cannot extend an old verification');
assert.strictEqual(Catalog.verificationInfo({ updated_at: '2026-10-15' }, { now }).date, '', 'file edits must not become check dates');

// Exercise the browser UMD exports as well as Node callers of the same policy.
const browser = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/tos-catalog-core.js'), 'utf8'), browser);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/home-discovery-core.js'), 'utf8'), browser);
const toses = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toses.json'), 'utf8'));
for (const item of toses) {
  const expected = Catalog.verificationStatus(item);
  assert.strictEqual(Home.verificationStatus(item), expected, `home status: ${item.slug}`);
  assert.strictEqual(browser.TosCatalogCore.verificationStatus(item), expected, `browser catalog status: ${item.slug}`);
  assert.strictEqual(browser.HomeDiscoveryCore.verificationStatus(item), expected, `browser home status: ${item.slug}`);
}

async function checkSearchOwnership() {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/site.js'), 'utf8');
  const start = source.indexOf('async function renderSearch()');
  const end = source.indexOf('\ninitCommonUi();', start);
  assert(start >= 0 && end > start, 'legacy search entry point must be exercisable');
  for (const indexed of [true, false]) {
    const result = { innerHTML: 'indexed results' };
    let fetches = 0;
    let handlers = 0;
    const input = { value: 'смета', addEventListener() { handlers++; } };
    const context = {
      $: selector => selector === '#search-results' ? result : input,
      document: { querySelector: () => indexed ? {} : null },
      getJSON: async () => { fetches++; return []; },
      isPublished: () => true,
      esc: value => String(value || '')
    };
    vm.runInNewContext(source.slice(start, end) + '\nthis.runSearch = renderSearch;', context);
    await context.runSearch();
    if (indexed) {
      assert.strictEqual(result.innerHTML, 'indexed results', 'legacy search must not replace indexed results');
      assert.strictEqual(fetches, 0, 'legacy search must not race the index fetch');
      assert.strictEqual(handlers, 0, 'one input must have one search owner');
    } else {
      assert.strictEqual(fetches, 9, 'legacy-only pages retain their compatibility search');
      assert.strictEqual(handlers, 1);
    }
  }
}

checkSearchOwnership().then(() => console.log(`Public search ownership and trust consistency OK: ${toses.length} cards, Node and browser exports`)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
