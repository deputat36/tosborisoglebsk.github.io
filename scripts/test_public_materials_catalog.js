const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const api = require('../assets/js/materials-core');
const base = process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173';
const output = '.artifacts/visual-baseline/materials-catalog';
const catalog = api.buildCatalog(JSON.parse(fs.readFileSync('data/materials.json')), JSON.parse(fs.readFileSync('data/articles.json')));
const ids = catalog.map(item => item.id).sort();

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const comparison = [];
  try {
    for (const width of [1280, 375]) {
      // A separate production view makes the intended library change reviewable.
      const beforeContext = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await beforeContext.newPage();
        await page.goto('https://tosborisoglebsk.ru/materials/', { waitUntil: 'networkidle', timeout: 20000 });
        comparison.push({ width, source: page.url(), cards: await page.locator('#articles-list article').count() });
        await page.screenshot({ path: `${output}/before-${width}.png` });
      } catch (error) { comparison.push({ width, source: 'production', capture_error: error.message }); }
      finally { await beforeContext.close(); }
      for (const mode of ['normal', 'no-js', 'failed-data', 'failed-script']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: mode !== 'no-js' });
        context.setDefaultTimeout(7000);
        if (mode === 'failed-data') await context.route('**/data/*.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
        if (mode === 'failed-script') await context.route('**/assets/js/materials*.js*', route => route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          assert((await page.goto(base + '/materials/', { waitUntil: 'networkidle' })).ok());
          const cards = page.locator('#articles-list [data-material-id]');
          const visibleIds = () => page.locator('#articles-list [data-material-id]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.materialId).sort());
          assert.deepEqual((await cards.evaluateAll(nodes => nodes.map(node => node.dataset.materialId))).sort(), ids, 'every material is present');
          assert.deepEqual(await visibleIds(), ids, 'nothing is lost without additional data or scripts');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'catalog fits the viewport');
          const interactive = !['no-js', 'failed-script'].includes(mode);
          assert.equal(await page.locator('#materials-filters').isVisible(), interactive);
          if (mode === 'normal' || mode === 'no-js') await page.screenshot({ path: `${output}/after-${mode}-${width}.png` });
          if (interactive) {
            const search = page.getByLabel('Что нужно сделать?', { exact: true });
            const topic = page.getByLabel('Тема', { exact: true });
            await search.fill('ОТЧЁТ');
            const withYo = await visibleIds();
            await search.fill('отчет');
            assert.deepEqual(await visibleIds(), withYo, 'ё/е and case produce the same selection');
            assert(withYo.includes('public-report'));
            await topic.selectOption('projects');
            await search.fill('смета');
            assert.equal(await page.locator('#articles-list [data-material-id]:visible').first().getAttribute('data-material-id'), 'simple-project-budget', 'most relevant guide comes first in DOM and reading order');
            const selected = await visibleIds();
            assert(selected.includes('simple-project-budget'));
            assert(selected.length > 0 && selected.length < ids.length);
            assert((await page.locator('#articles-list [data-material-id]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.materialTopic))).every(value => value === 'projects'));
            await search.press('Enter');
            const selectedUrl = page.url();
            assert.equal(new URL(selectedUrl).searchParams.get('q'), 'смета');
            assert.equal(new URL(selectedUrl).searchParams.get('topic'), 'projects');
            if (mode === 'normal') {
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
              await page.screenshot({ path: `${output}/filtered-${width}.png`, fullPage: true });
              await page.locator('[data-material-id="simple-project-budget"] a').click();
              await page.waitForURL('**/materials/simple-project-budget/');
              await page.goBack({ waitUntil: 'networkidle' });
              assert.equal(page.url(), selectedUrl, 'return to the saved selection');
              assert.deepEqual(await visibleIds(), selected);
              await page.reload({ waitUntil: 'networkidle' });
              assert.deepEqual(await visibleIds(), selected, 'shared URL restores filters');
            }
            await search.fill('несуществующий запрос 78128');
            assert.equal((await visibleIds()).length, 0);
            assert(await page.locator('#materials-empty').isVisible());
            await page.locator('#materials-empty button').click();
            assert.deepEqual(await visibleIds(), ids);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'materials-search', 'reset returns focus to search');
            await page.goto(base + '/materials/?topic=unknown&q=%D1%81%D0%BC%D0%B5%D1%82%D0%B0&utm_source=check', { waitUntil: 'networkidle' });
            assert.equal(await topic.inputValue(), '', 'unknown theme does not hide the catalog');
            assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'check');
            assert((await visibleIds()).includes('simple-project-budget'));
          }
          assert.deepEqual(errors, [], 'no runtime errors');
          results.push({ width, mode, passed: true, cards: catalog.length });
        } catch (error) { results.push({ width, mode, passed: false, error: error.message }); }
        finally { await context.close(); }
      }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(`${output}/report.json`, JSON.stringify({ results, comparison }, null, 2) + '\n');
  }
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
  console.log(`Materials browser OK: ${results.length} desktop/mobile scenarios; search, saved links, history, no JS and failed requests`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
