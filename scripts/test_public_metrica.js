'use strict';
// CI-only browser coverage: every request is fulfilled locally or aborted.
// No test visit or form value is sent to the real analytics service.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const C = require('../assets/js/analytics-core');
const origin = 'https://tosborisoglebsk.ru';
const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp' };
async function context(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const requests = [];
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'mc.yandex.ru') {
      requests.push(url.href);
      return route.fulfill({ contentType: 'application/javascript', body: 'document.dispatchEvent(new Event("yacounter114258941inited"));' });
    }
    if (url.origin !== origin) return route.abort();
    let name = decodeURIComponent(url.pathname);
    if (name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
    return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
  });
  return { ctx, requests };
}
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      const { ctx, requests } = await context(browser, viewport);
      const page = await ctx.newPage();
      await page.goto(origin + '/privacy/?q=private-contact#analytics');
      const banner = page.getByRole('region', { name: 'Выбор аналитики' });
      await banner.waitFor();
      assert.equal(requests.length, 0, 'no external analytics before choice');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile must not overflow');
      fs.mkdirSync('.artifacts/visual-baseline/metrica', { recursive: true });
      await page.screenshot({ path: `.artifacts/visual-baseline/metrica/choice-${viewport.width}.png` });
      await banner.getByRole('button', { name: 'Без аналитики', exact: true }).click();
      await page.reload();
      assert.equal(await page.locator('#tos-metrica-tag').count(), 0, 'refusal survives reload');
      assert.equal(requests.length, 0);
      await page.getByRole('button', { name: 'Разрешить аналитику', exact: true }).click();
      await page.waitForSelector('html[data-analytics-state="active"]');
      assert.equal(requests.length, 1);
      const queued = await page.evaluate(() => window.ym.a.map(args => Array.from(args)));
      assert.equal(queued.length, 2);
      assert.equal(queued[1][1], 'hit');
      assert.equal(queued[1][2], origin + '/privacy/');
      assert(!JSON.stringify(queued).includes('private-contact'));
      const second = await ctx.newPage();
      await second.goto(origin + '/tos/uyutnyy/');
      await second.waitForSelector('html[data-analytics-state="active"]');
      await page.getByRole('button', { name: 'Без аналитики', exact: true }).click();
      await page.waitForSelector('html[data-analytics-state="off"]');
      await second.waitForSelector('html[data-analytics-state="off"]');
      assert.equal(await page.locator('#tos-metrica-tag').count(), 0);
      assert.equal(await second.locator('#tos-metrica-tag').count(), 0, 'withdrawal stops other tab');
      const before = requests.length;
      await page.goto(origin + '/documents/templates/project-passport/');
      assert.equal(requests.length, before, 'draft form excluded');
      await ctx.close();
    }
    const { ctx, requests } = await context(browser, { width: 390, height: 844 });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
      localStorage.setItem('tos-bgo-analytics-v1', JSON.stringify({ version: 1, choice: 'granted', at: Date.now() - 1000 }));
    });
    const page = await ctx.newPage();
    await page.goto(origin + '/privacy/#analytics');
    assert.equal(requests.length, 0, 'GPC overrides previous grant');
    assert(await page.getByRole('button', { name: 'Разрешить аналитику', exact: true }).isDisabled());
    await ctx.close();
    console.log('Metrica browser OK: desktop/mobile consent, refusal, cleaned hit, cross-tab withdrawal, private drafts and GPC; all requests mocked');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
