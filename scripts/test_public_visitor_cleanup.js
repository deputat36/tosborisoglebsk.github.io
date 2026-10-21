const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = '.artifacts/visual-baseline/visitor-cleanup';
const news = JSON.parse(fs.readFileSync('data/news.json'));
const report = [];

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [390, 1440]) for (const mode of ['normal', 'no-js']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: mode !== 'no-js' });
      try {
        for (const route of ['map', 'news', 'done', 'update-tos']) {
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:4173/${route}/`);
          if (mode === 'normal' && ['news', 'done'].includes(route)) await page.locator(`#${route}-search:enabled`).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route}: page fits screen`);
          if (mode === 'normal') await page.screenshot({ path: path.join(output, `${route}-${width}.png`) });
          if (route === 'map') {
            const body = await page.locator('main').innerText();
            assert.ok(!/GeoJSON|Leaflet|data\/toses|geometry_role|\bslug\b/.test(body));
            assert.ok(body.includes('проверенные точки и границы пока не опубликованы'));
            await page.locator('#map-rules summary').click();
            assert.ok((await page.locator('#map-rules').innerText()).includes('Не является границей'));
          }
          if (route === 'news') {
            const feature = page.locator('[data-news-featured]');
            const id = await feature.getAttribute('data-news-featured');
            const item = news.find((entry) => entry.id === id);
            assert.equal(await feature.locator('h2').innerText(), item.title);
            assert.ok((await feature.innerText()).includes(item.lead));
            assert.ok(!(await feature.innerText()).includes('Сроки и ход реализации пока уточняются'));
            await page.locator('#news-guide > summary').click();
            assert.equal(await page.locator('#news-guide').evaluate((element) => element.open), true);
          }
          if (route === 'done') {
            assert.ok(await page.locator('#done-list > article.done-story').count() > 0);
            assert.equal(await page.locator('#done-guide').evaluate((element) => element.open), false);
            await page.locator('#done-guide > summary').click();
            assert.equal(await page.locator('#done-guide').evaluate((element) => element.open), true);
          }
          if (route === 'update-tos') {
            assert.equal(await page.locator('#download-intake-csv').isVisible(), false);
            assert.equal(await page.locator('#download-queue-csv').isVisible(), false);
            assert.ok((await page.locator('.update-preview').innerText()).includes('Копирование и скачивание не отправляют материал'));
            await page.locator('#editorial-tools > summary').click();
            assert.equal(await page.locator('#download-intake-csv').isVisible(), true);
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route}: expanded instructions fit screen`);
          if (mode === 'normal') await page.screenshot({ path: path.join(output, `${route}-${width}-details.png`) });
          report.push({ route, width, mode, passed: true });
          await page.close();
        }
      } finally { await context.close(); }
    }
    console.log(`Visitor cleanup browser OK: ${report.length} cases`);
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
