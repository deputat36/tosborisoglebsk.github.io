const assert = require('assert');
const { chromium } = require('playwright');
const base = process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173';

async function main() {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 768, 1180, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, { waitUntil: 'networkidle' });
      assert(await page.locator('.brand img').evaluate(node => node.getBoundingClientRect().width <= node.parentElement.getBoundingClientRect().width + 1), `logo clipped at ${width}`);
      const search = page.locator('#home-tos-search');
      await search.fill('Подстепки');
      await page.locator('.home-search-result[href="/tos/podstepki/"]').waitFor();
      await search.fill('zzzz-no-tos-match');
      assert.strictEqual(await page.locator('.home-search-result').count(), 0);
      await page.locator('#home-tos-search-clear').click();
      assert.strictEqual(await search.inputValue(), '');
      assert(await search.evaluate(node => node === document.activeElement));
      await page.locator('.catalog-details summary').click();
      assert(await page.locator('#home-stats').isVisible());
      await page.locator('.home-current-card summary').click();
      assert(await page.locator('#home-current-overview').isVisible());
      await page.locator('[data-action=theme]').click();
      assert.strictEqual(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert((await page.locator('.brand img').getAttribute('src')).endsWith('logo-dark.svg'));
      await page.reload({ waitUntil: 'networkidle' });
      assert.strictEqual(await page.locator('html').getAttribute('data-theme'), 'dark');
      if (width <= 1120) {
        await page.locator('[data-action=menu]').click();
        assert.strictEqual(await page.locator('[data-action=menu]').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.strictEqual(await page.locator('[data-action=menu]').getAttribute('aria-expanded'), 'false');
        assert(await page.locator('[data-action=menu]').evaluate(node => node === document.activeElement));
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
      assert.deepStrictEqual(errors, []);
      await page.close();
      console.log(`Brand redesign interactions OK: ${width}px`);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
