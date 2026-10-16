const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = (process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = '.artifacts/visual-baseline/learning-materials';
const routes = [
  ['meeting', '/meeting-kit/', 'На чём основаны рекомендации'],
  ['resources', '/materials/community-resource-map/', 'Источники и границы применения'],
  ['future', '/materials/territory-future-workshop/', 'Источники и границы применения']
];

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const mode of ['desktop', 'mobile', 'without-js']) {
      const context = await browser.newContext({ viewport: { width: mode === 'desktop' ? 1280 : 375, height: 900 }, javaScriptEnabled: mode !== 'without-js' });
      const page = await context.newPage();
      for (const [id, route, sourcesHeading] of routes) {
        try {
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const response = await page.goto(base + route, { waitUntil: 'networkidle' });
          assert(response.ok());
          assert.equal(await page.locator('main h1').count(), 1);
          assert(await page.getByRole('heading', { name: sourcesHeading, exact: true }).isVisible());
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'content fits a phone');
          if (id === 'meeting') {
            const summary = page.locator('summary', { hasText: 'Как отвечать на трудные реплики' });
            await summary.press('Enter');
            assert.equal(await summary.locator('..').getAttribute('open'), '', 'discussion help opens with the keyboard and without JavaScript');
            const file = await page.locator('a[download]').first().getAttribute('href');
            const download = await context.request.get(base + file);
            assert(download.ok());
            assert((await download.text()).includes('Рабочий лист не заменяет протокол'));
          }
          if (id === 'future') assert((await page.locator('main').innerText()).includes('Художественный рассказ'));
          const links = await page.locator('main a[href^="/"]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href').split('#')[0]))]);
          for (const href of links) assert((await context.request.get(base + href)).ok(), `destination available: ${href}`);
          assert.deepEqual(errors, []);
          if (mode !== 'without-js') {
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${output}/${id}-${mode}.png`, fullPage: true });
          }
          results.push({ mode, route, passed: true });
        } catch (error) {
          results.push({ mode, route, passed: false, error: error.message });
        } finally { page.removeAllListeners('pageerror'); }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results }, null, 2) + '\n');
  }
  const failed = results.filter(result => !result.passed);
  assert.equal(failed.length, 0, JSON.stringify(failed));
  console.log(`Learning materials: ${results.length}/${results.length}, desktop, mobile, keyboard, downloads and no JavaScript`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
