#!/usr/bin/env node
// End-to-end smoke for the PUBLICLY LABELLED synthetic UI only. No real codes or production API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const BASE = process.env.BATTLE_DEMO_BASE_URL || 'http://127.0.0.1:4173';
const OUTPUT = path.resolve('.artifacts/culinary-battle');
const issue = (message) => { throw new Error(message); };

async function run() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const config of [
      { name: 'desktop', width: 1366, height: 900 },
      { name: 'mobile', width: 390, height: 844 }
    ]) {
      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        reducedMotion: 'reduce',
        acceptDownloads: true
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(BASE + '/culinary-battle/?demo=1', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => !document.getElementById('battle-team').disabled);
      assert.equal(await page.locator('#battle-team option').count(), 19);
      assert.match(await page.locator('.battle-demo-banner').innerText(), /ДЕМО/);
      assert.equal(await page.locator('#battle-submit').isDisabled(), false);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow < 3, 'Unexpected horizontal overflow: ' + overflow + 'px on ' + config.name);
      await page.screenshot({ path: path.join(OUTPUT, 'demo-' + config.name + '.png'), fullPage: true });

      await page.locator('#battle-search').fill('Яблоневый');
      assert.equal(await page.locator('#battle-team option').count(), 2);
      await page.locator('#battle-team').selectOption('demo-02');
      assert.match(await page.locator('#battle-demo-code-hint').innerText(), /DEMO-02-2026/);
      await page.locator('#battle-code').fill('DEMO-01-2026');
      await page.locator('#battle-submit').click();
      await page.locator('#battle-error').waitFor({ state: 'visible' });
      assert.match(await page.locator('#battle-error').innerText(), /другой демо-код/);
      assert.equal(await page.locator('#battle-result').isVisible(), false);

      await page.locator('#battle-code').fill('DEMO-02-2026');
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({ state: 'visible' });
      const name = await page.locator('#battle-result-team').innerText();
      assert.match(name, /^Учебный ТОС №02/);
      const dish = await page.locator('#battle-result-dish').innerText();
      assert.ok(dish && dish.length > 4);
      assert.equal(await page.locator('#battle-reveal').isVisible(), false);
      await page.screenshot({ path: path.join(OUTPUT, 'result-' + config.name + '.png'), fullPage: true });

      const download = page.waitForEvent('download');
      await page.locator('#battle-download').click();
      const saved = await download;
      assert.ok(saved.suggestedFilename().endsWith('.png'));
      await saved.saveAs(path.join(OUTPUT, 'download-' + config.name + '.png'));
      const bytes = fs.readFileSync(path.join(OUTPUT, 'download-' + config.name + '.png'));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

      // Same team & code always return the same synthetic dish, even after reload.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.getElementById('battle-team').disabled);
      await page.locator('#battle-team').selectOption('demo-02');
      await page.locator('#battle-code').fill('DEMO-02-2026');
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#battle-result-dish').innerText(), dish);

      await page.locator('#battle-team').selectOption('demo-03');
      await page.locator('#battle-code').fill('DEMO-03-2026');
      await page.locator('#battle-submit').click();
      await page.locator('#battle-result').waitFor({ state: 'visible' });
      assert.notEqual(await page.locator('#battle-result-dish').innerText(), dish);

      // No fake roster must leak into the normal production-facing route.
      await page.goto(BASE + '/culinary-battle/', { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('#battle-submit').isDisabled(), true);
      assert.equal(await page.locator('.battle-demo-banner').count(), 0);
      assert.equal(await page.locator('#battle-result').isVisible(), false);
      assert.deepEqual(errors, [], 'Unexpected uncaught browser errors');
      await context.close();
      process.stdout.write('PASS ' + config.name + ': demo access, search, validation, PNG, repeat, safety\n');
    }
  } finally {
    await browser.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
