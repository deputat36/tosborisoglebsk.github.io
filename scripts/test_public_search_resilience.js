'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173';
const OUT = '.artifacts/visual-baseline/search-resilience';
const index = JSON.parse(fs.readFileSync('data/page_index.json', 'utf8'));
const fixtures = index.pages.filter(p => p.search_group === 'news').slice(0, 122).map((p, i) => ({ ...p, title: 'Кейс поиска ' + String(i).padStart(3, '0'), description: 'Учебная проверка поиска', content_origin: 'editorial' }));
assert.equal(fixtures.length, 122);
const body = JSON.stringify({ pages: fixtures, search_groups: { news: 'Новости' } });
const cards = '#search-results .search-result[data-search-group]';

async function context(browser, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, ...options });
  const page = await ctx.newPage();
  return { ctx, page };
}
async function ready(page) {
  await page.waitForSelector(cards);
  assert.equal(await page.locator('#search-results').getAttribute('aria-busy'), 'false');
}
async function fits(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 1280]) {
      const { ctx, page } = await context(browser, { viewport: { width, height: 900 } });
      page.on('pageerror', e => errors.push(e.message));
      await ctx.route('**/data/page_index.json', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
      await page.goto(BASE + '/search/?q=Кейс&type=news&origin=editorial&sort=title');
      await ready(page);
      assert.equal(await page.locator(cards).count(), 60);
      assert.match(await page.locator('#search-filter-status').innerText(), /Показано 60 из 122/);
      await page.locator('#search-more-results').click();
      assert.equal(await page.locator(cards).count(), 120);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#search-results a.btn')].indexOf(document.activeElement)), 60, 'keyboard focus reaches the first newly available result');
      await page.locator('#search-more-results').click();
      assert.equal(await page.locator(cards).count(), 122);
      const hrefs = await page.locator(cards + ' a.btn').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
      assert.equal(new Set(hrefs).size, 122, 'later batches do not duplicate earlier results');
      assert(hrefs.includes(new URL(fixtures[121].url).pathname), 'the last matching page is reachable');
      assert.equal(await page.locator('#search-more-results').isVisible(), false);
      await page.locator('#site-search').fill('Кейс поиска 00');
      assert.equal(await page.locator(cards).count(), 10);
      await page.locator('#site-search').fill('Кейс');
      assert.equal(await page.locator(cards).count(), 60, 'changing filters resets the displayed batch');
      await page.evaluate(() => history.pushState(null, '', '?q=Другой&type=news&origin=editorial&sort=title'));
      await page.locator('#site-search').fill('нет совпадений');
      assert.equal(await page.locator(cards).count(), 0);
      await page.goBack();
      await ready(page);
      assert.equal(await page.locator('#site-search').inputValue(), 'Кейс');
      assert.equal(await page.locator(cards).count(), 60, 'Back restores the URL and matching results');
      await page.locator('#site-search').fill('<img src=x onerror=alert(1)>');
      assert.equal(await page.locator(cards).count(), 0);
      assert.equal(await page.locator('#search-results img').count(), 0);
      assert.equal(await page.locator('#search-more-results').isVisible(), false);
      await page.locator('#search-reset-filters').click();
      assert.equal(await page.locator('#search-results .search-result').count(), 4);
      await fits(page);
      await page.screenshot({ path: path.join(OUT, 'search-' + width + '.png') });
      await ctx.close();
    }

    for (const failure of ['http', 'invalid', 'json', 'network']) {
      const { ctx, page } = await context(browser);
      page.on('pageerror', e => errors.push(e.message));
      let requests = 0;
      await ctx.route('**/data/page_index.json', route => {
        if (++requests > 1) return route.fulfill({ status: 200, contentType: 'application/json', body });
        if (failure === 'network') return route.abort('failed');
        return route.fulfill({ status: failure === 'http' ? 503 : 200, contentType: 'application/json', body: failure === 'json' ? '{"pages":' : '{"pages":[]}' });
      });
      await page.goto(BASE + '/search/?q=Кейс&type=news&origin=editorial');
      await page.locator('#search-retry').waitFor({ state: 'visible' });
      assert.match(await page.locator('#search-filter-status').innerText(), /Поиск временно недоступен/);
      assert(!(await page.locator('#search-results').innerText()).includes('Ничего не найдено'));
      assert.equal(await page.locator('#search-results .search-result').count(), 4, 'routes remain available during a search failure');
      await page.locator('#site-search').fill('Кейс поиска 00');
      assert.match(await page.locator('#search-filter-status').innerText(), /Поиск временно недоступен/);
      assert.equal(new URL(page.url()).searchParams.get('type'), 'news');
      await fits(page);
      if (failure === 'http') await page.screenshot({ path: path.join(OUT, 'search-retry-390.png') });
      await page.locator('#search-retry').click();
      await ready(page);
      assert.equal(requests, 2, 'retry is explicit and does not loop');
      assert.equal(await page.locator('#site-search').inputValue(), 'Кейс поиска 00');
      assert.equal(await page.locator('#search-type-filter').inputValue(), 'news');
      assert.equal(await page.locator(cards).count(), 10);
      assert.equal(await page.locator('#search-retry').isVisible(), false);
      await ctx.close();
    }

    {
      const { ctx, page } = await context(browser);
      let release;
      const pending = new Promise(resolve => { release = resolve; });
      await ctx.route('**/data/page_index.json', async route => { await pending; await route.fulfill({ status: 200, contentType: 'application/json', body }); });
      await page.goto(BASE + '/search/?q=Старый&type=news&origin=editorial', { waitUntil: 'domcontentloaded' });
      await page.locator('#search-controls').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#search-results').getAttribute('aria-busy'), 'true');
      await page.locator('#site-search').fill('Кейс поиска 00');
      assert.match(await page.locator('#search-filter-status').innerText(), /Загружаем поиск/);
      release();
      await ready(page);
      assert.equal(await page.locator('#site-search').inputValue(), 'Кейс поиска 00', 'a delayed response must not overwrite what the visitor typed');
      assert.equal(await page.locator(cards).count(), 10);
      await ctx.close();
    }
    {
      const { ctx, page } = await context(browser, { javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
      await page.goto(BASE + '/search/');
      assert.equal(await page.locator('#search-controls').isVisible(), false);
      assert.equal(await page.locator('#search-results a').count(), 4);
      assert.match(await page.locator('#search-results').innerText(), /JavaScript выключен/);
      assert(!(await page.locator('#search-results').innerText()).includes('Загрузка'));
      await fits(page);
      await ctx.close();
    }
    {
      const { ctx, page } = await context(browser);
      await ctx.route('**/assets/js/search-browser-core.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* unavailable */' }));
      await page.goto(BASE + '/search/');
      assert.equal(await page.locator('#search-controls').isVisible(), false);
      assert.equal(await page.locator('#search-results a').count(), 4);
      assert.match(await page.locator('#search-filter-status').innerText(), /Поиск по словам сейчас недоступен/);
      await ctx.close();
    }
    assert.deepEqual(errors, []);
    console.log('Search resilience OK: all 122 matches reachable, keyboard focus, filter and history reset, explicit retry after HTTP/JSON/network failures, pending query preserved and usable no-script routes');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
