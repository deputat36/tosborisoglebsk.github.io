const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.PUBLIC_BROWSER_REPORT || '.artifacts/public-browser-interactions.json');
const IMPOSSIBLE_QUERY = 'zzzz-public-browser-no-result-2026';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function searchFixture() {
  const news = readJson('data/news.json')
    .filter((item) => item && item.status !== 'draft' && String(item.title || '').trim())
    .map((item) => ({
      item,
      origin: inferContentOrigin(item, 'news')
    }));
  const originRank = { verified: 0, editorial: 1, starter: 2, request: 3 };
  news.sort((a, b) => (originRank[a.origin] ?? 9) - (originRank[b.origin] ?? 9)
    || String(a.item.title).localeCompare(String(b.item.title), 'ru'));
  const selected = news[0];
  assert(selected, 'search fixture: no published news records');
  return {
    query: String(selected.item.title).trim(),
    origin: selected.origin
  };
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function waitForStatus(page, selector) {
  await page.waitForFunction((target) => {
    const node = document.querySelector(target);
    return Boolean(node && node.textContent && node.textContent.trim());
  }, selector);
}

async function urlParams(page) {
  return page.evaluate(() => Object.fromEntries(new URLSearchParams(window.location.search).entries()));
}

async function testSearch(page) {
  const fixture = searchFixture();
  const params = new URLSearchParams({
    q: fixture.query,
    type: 'news',
    origin: fixture.origin,
    sort: 'title'
  });
  await openRoute(page, `/search/?${params.toString()}`);
  await page.waitForSelector(`#search-results .search-result[data-search-group="news"][data-content-origin="${fixture.origin}"]`);
  await waitForStatus(page, '#search-filter-status');

  assert(await page.locator('#site-search').inputValue() === fixture.query, 'search: query was not restored from URL');
  assert(await page.locator('#search-type-filter').inputValue() === 'news', 'search: type filter was not restored');
  assert(await page.locator('#search-origin-filter').inputValue() === fixture.origin, 'search: origin filter was not restored');
  assert(await page.locator('#search-sort').inputValue() === 'title', 'search: sort was not restored');

  const cards = page.locator('#search-results .search-result[data-search-group]');
  assert(await cards.count() > 0, 'search: current news fixture returned no cards');
  const metadata = await cards.evaluateAll((nodes) => nodes.map((node) => ({
    group: node.dataset.searchGroup,
    origin: node.dataset.contentOrigin,
    text: node.textContent || ''
  })));
  metadata.forEach((item) => {
    assert(item.group === 'news', `search: unexpected group ${item.group}`);
    assert(item.origin === fixture.origin, `search: unexpected origin ${item.origin}`);
    assert(normalize(item.text).includes(normalize(fixture.query)), 'search: result does not match current news fixture');
  });

  await page.locator('#site-search').press('Escape');
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('q'));
  assert(await page.locator('#site-search').inputValue() === '', 'search: Escape did not clear query');

  await page.locator('#search-reset-filters').click();
  await page.waitForSelector('#search-results .section-head');
  const restoredParams = await urlParams(page);
  assert(!restoredParams.q && !restoredParams.type && !restoredParams.origin, 'search: reset left active query filters in URL');
  assert(restoredParams.sort === 'relevance', 'search: reset did not restore relevance sort');
  assert(await page.locator('#search-results .search-result').count() === 4, 'search: quick links were not restored after reset');
}

async function testTosCatalog(page) {
  const mirolyubieRoute = '/tos/?q=%D0%9C%D0%B8%D1%80%D0%BE%D0%BB%D1%8E%D0%B1%D0%B8%D0%B5';
  await openRoute(page, mirolyubieRoute);
  await page.waitForSelector('#tos-list .improved-tos-card');
  await waitForStatus(page, '#catalog-filter-status');
  await page.waitForSelector('#find-tos-guidance[data-resolution="single"]');

  const initialCards = page.locator('#tos-list .improved-tos-card');
  assert(await initialCards.count() > 0, 'tos catalog: query returned no cards');
  const texts = await initialCards.allTextContents();
  texts.forEach((text) => assert(normalize(text).includes('миролюбие'), 'tos catalog: card does not match query'));
  assert(await page.locator('#find-tos-guidance [data-find-tos-card]').getAttribute('href') === '/tos/mirolyubie/', 'tos catalog: single match does not expose the direct card route');
  const singleHelpHref = await page.locator('#find-tos-guidance [data-find-tos-request]').getAttribute('href');
  const singleHelpUrl = new URL(singleHelpHref, BASE_URL);
  assert(singleHelpUrl.searchParams.get('request') === 'find-tos', 'tos catalog: single-result help route is missing request mode');
  assert(singleHelpUrl.searchParams.get('query') === 'Миролюбие', 'tos catalog: single-result help route lost the search query');

  await page.locator('#search').fill(IMPOSSIBLE_QUERY);
  await page.waitForSelector('#tos-list .empty');
  await page.waitForSelector('#find-tos-guidance[data-resolution="none"] [data-find-tos-request]');
  const relayLink = page.locator('#find-tos-guidance [data-find-tos-request]');
  const relayHref = await relayLink.getAttribute('href');
  const relayUrl = new URL(relayHref, BASE_URL);
  assert(relayUrl.pathname === '/contacts/', 'tos catalog: no-result route does not point to contacts');
  assert(relayUrl.searchParams.get('request') === 'find-tos', 'tos catalog: no-result route is missing request mode');
  assert(relayUrl.searchParams.get('query') === IMPOSSIBLE_QUERY, 'tos catalog: no-result route lost the search query');
  assert(relayUrl.hash === '#relay-tos', 'tos catalog: no-result route is missing relay anchor');

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/contacts/' && url.searchParams.get('request') === 'find-tos' && url.searchParams.get('query') === IMPOSSIBLE_QUERY && url.hash === '#relay-tos'),
    relayLink.click()
  ]);
  await page.waitForFunction((query) => {
    const context = document.querySelector('#relay-tos-context');
    const template = document.querySelector('#relay-tos-template');
    return Boolean(context && template && context.textContent.includes('не отправлен автоматически') && template.value.includes(`Поисковый запрос: ${query}`));
  }, IMPOSSIBLE_QUERY);
  assert(await page.locator('#relay-tos').count() === 1, 'tos catalog: editorial relay destination is missing');
  const relayContext = (await page.locator('#relay-tos-context').textContent() || '').trim();
  const relayTemplate = await page.locator('#relay-tos-template').inputValue();
  assert(relayContext.includes('номер квартиры'), 'tos catalog: relay context lacks personal-data warning');
  assert(relayTemplate.includes(`Поисковый запрос: ${IMPOSSIBLE_QUERY}`), 'tos catalog: relay template did not preserve the query');
  assert(relayTemplate.includes('Что нужно уточнить: к какому ТОС относится указанная территория'), 'tos catalog: relay template lacks the intended question');

  const returnLink = page.locator('#relay-tos-card-link');
  assert(!await returnLink.isHidden(), 'tos catalog: return-to-search link is hidden');
  assert(await returnLink.textContent() === 'Вернуться к результатам поиска ТОС', 'tos catalog: return-to-search label is wrong');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/tos/' && url.searchParams.get('q') === IMPOSSIBLE_QUERY),
    returnLink.click()
  ]);
  await page.waitForSelector('#find-tos-guidance[data-resolution="none"]');
  assert(await page.locator('#search').inputValue() === IMPOSSIBLE_QUERY, 'tos catalog: return link did not restore query');

  await page.locator('#search').press('Escape');
  await page.waitForSelector('#tos-list .improved-tos-card');
  await page.waitForFunction(() => {
    const node = document.querySelector('#find-tos-guidance');
    return Boolean(node && node.dataset.resolution === 'start' && node.hidden);
  });
  assert(await page.locator('#search').inputValue() === '', 'tos catalog: Escape did not clear query');

  const typeOptions = await page.locator('#type-filter option').evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
  assert(typeOptions.length > 0, 'tos catalog: type options are missing');
  await page.locator('#type-filter').selectOption(typeOptions[0]);
  await page.waitForFunction(() => new URLSearchParams(location.search).has('type'));
  await page.locator('#reset-filters').click();
  await page.waitForFunction(() => location.search === '');
  assert(await page.locator('#type-filter').inputValue() === '', 'tos catalog: reset did not clear type');
  assert(await page.locator('#search').inputValue() === '', 'tos catalog: reset did not clear search');
}

async function testPlaces(page) {
  await openRoute(page, '/places/?q=%D0%91%D0%BE%D1%80%D0%B8%D1%81%D0%BE%D0%B3%D0%BB%D0%B5%D0%B1%D1%81%D0%BA');
  await page.waitForSelector('#places-grid [data-place-slug]:not([hidden])');
  await waitForStatus(page, '#place-filter-status');

  assert(await page.locator('#place-search').inputValue() === 'Борисоглебск', 'places: query was not restored');
  const matchingNames = await page.locator('#places-grid [data-place-slug]:not([hidden])').evaluateAll((nodes) => nodes.map((node) => node.dataset.placeName || ''));
  assert(matchingNames.length > 0, 'places: query returned no territories');
  matchingNames.forEach((name) => assert(normalize(name).includes('борисоглебск'), 'places: territory does not match query'));

  await page.locator('#place-search').press('Escape');
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('q'));
  await page.locator('#place-count-filter').selectOption('multiple');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('count') === 'multiple');
  const multipleCards = page.locator('#places-grid [data-place-slug]:not([hidden])');
  assert(await multipleCards.count() > 0, 'places: multiple filter returned no territories');
  const counts = await multipleCards.evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.placeCount || 0)));
  counts.forEach((count) => assert(count > 1, `places: multiple filter exposed count ${count}`));

  await page.locator('#place-reset-filters').click();
  await page.waitForFunction(() => location.search === '');
  assert(await page.locator('#place-count-filter').inputValue() === 'all', 'places: reset did not restore count filter');
  assert(await page.locator('#place-search').inputValue() === '', 'places: reset did not clear query');
}

async function testCollection(page, config) {
  await openRoute(page, `${config.route}?origin=${config.origin}`);
  await page.waitForSelector(`${config.root} [data-content-origin="${config.origin}"]`);
  await waitForStatus(page, config.status);

  assert(await page.locator(config.originControl).inputValue() === config.origin, `${config.name}: origin was not restored`);
  const cards = page.locator(`${config.root} [data-content-origin]`);
  assert(await cards.count() > 0, `${config.name}: origin filter returned no cards`);
  const origins = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.contentOrigin || ''));
  origins.forEach((origin) => assert(origin === config.origin, `${config.name}: unexpected origin ${origin}`));

  await page.locator(config.search).fill(IMPOSSIBLE_QUERY);
  await page.waitForSelector(`${config.root} .empty`);
  await page.locator(config.search).press('Escape');
  await page.waitForSelector(`${config.root} [data-content-origin="${config.origin}"]`);
  assert(await page.locator(config.search).inputValue() === '', `${config.name}: Escape did not clear query`);

  await page.locator(config.reset).click();
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('origin'));
  assert(await page.locator(config.originControl).inputValue() === '', `${config.name}: reset did not clear origin`);
  assert(await page.locator(`${config.root} [data-content-origin]`).count() >= origins.length, `${config.name}: reset did not restore cards`);
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const scenarios = [
    ['global-search', testSearch],
    ['tos-catalog', testTosCatalog],
    ['places-browser', testPlaces],
    ['news-browser', (page) => testCollection(page, { name: 'news', route: '/news/', root: '#news-feed', status: '#news-filter-status', search: '#news-search', originControl: '#news-origin-filter', reset: '#news-reset-filters', origin: 'request' })],
    ['projects-browser', (page) => testCollection(page, { name: 'projects', route: '/projects/', root: '#projects-list', status: '#projects-filter-status', search: '#projects-search', originControl: '#projects-origin-filter', reset: '#projects-reset-filters', origin: 'starter' })],
    ['done-browser', (page) => testCollection(page, { name: 'done', route: '/done/', root: '#done-list', status: '#done-filter-status', search: '#done-search', originControl: '#done-origin-filter', reset: '#done-reset-filters', origin: 'request' })],
    ['needs-browser', (page) => testCollection(page, { name: 'needs', route: '/needs/', root: '#needs-list', status: '#needs-filter-status', search: '#needs-search', originControl: '#needs-origin-filter', reset: '#needs-reset-filters', origin: 'request' })]
  ];

  try {
    for (const [name, run] of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const technicalErrors = [];
      page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

      const startedAt = Date.now();
      try {
        await run(page);
        assert(technicalErrors.length === 0, `${name}: technical errors: ${technicalErrors.join(' | ')}`);
        results.push({ name, status: 'passed', duration_ms: Date.now() - startedAt, url: page.url(), technical_errors: [] });
        console.log(`PASS ${name}`);
      } catch (error) {
        results.push({ name, status: 'failed', duration_ms: Date.now() - startedAt, url: page.url(), error: error.message, technical_errors: technicalErrors });
        console.error(`FAIL ${name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (report.failed) throw new Error(`Public browser interactions failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`Public browser interactions OK: ${report.passed}/${report.total}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
