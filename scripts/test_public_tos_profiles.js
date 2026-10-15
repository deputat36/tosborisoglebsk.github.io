const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = (process.env.TOS_PROFILES_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const reportPath = process.env.TOS_PROFILES_REPORT || '.artifacts/tos-profiles-browser.json';
const data = JSON.parse(fs.readFileSync('data/tos_profiles.json', 'utf8'));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const mode of ['desktop', 'mobile', 'without-js']) {
      const context = await browser.newContext({ viewport: { width: mode === 'desktop' ? 1280 : 375, height: 900 }, javaScriptEnabled: mode !== 'without-js' });
      context.setDefaultTimeout(5000);
      const page = await context.newPage();
      for (const profile of data.profiles) {
        const errors = [];
        const onError = error => errors.push(error.message);
        page.on('pageerror', onError);
        try {
          const response = await page.goto(`${base}/tos/${profile.tos_slug}/`, { waitUntil: 'networkidle' });
          assert(response.ok(), 'card must load');
          await page.getByRole('link', { name: 'История и дела', exact: true }).click();
          assert.equal(new URL(page.url()).hash, '#tos-profile');
          const section = page.locator('#tos-profile');
          assert.equal(await section.locator('[data-profile-fact]').count(), profile.facts.length, 'all sourced facts survive rendering');
          const links = await section.locator('.tos-profile-sources a').evaluateAll(nodes => nodes.map(node => ({ href: node.href, label: node.getAttribute('aria-label') })));
          const ids = profile.facts.flatMap(fact => fact.source_ids);
          assert.deepEqual(links.map(link => link.href), ids.map(id => new URL(data.sources.find(source => source.id === id).url).href));
          assert(links.every(link => link.label?.startsWith('Источник:')), 'source links need descriptive labels');
          const summary = section.locator('summary');
          if (mode === 'without-js') await summary.press('Enter');
          else await summary.click();
          assert.equal(await section.locator('details').getAttribute('open'), '', 'clarifications open without custom JavaScript');
          const href = await section.getByRole('link', { name: 'Передать уточнение', exact: true }).getAttribute('href');
          assert.equal(new URL(href, base).searchParams.get('tos'), profile.tos_slug, 'correction must keep its TOC');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'card must fit the viewport');
          assert.deepEqual(errors, [], 'no JavaScript failures');
          results.push({ mode, slug: profile.tos_slug, passed: true, facts: profile.facts.length });
        } catch (error) {
          results.push({ mode, slug: profile.tos_slug, passed: false, error: error.message });
          console.error(`FAIL ${mode} ${profile.tos_slug}: ${error.message}`);
        } finally { page.off('pageerror', onError); }
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + '\n');
      }
      await context.close();
      console.log(`TOS profiles browser: ${mode} complete`);
    }
  } finally { await browser.close(); }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + '\n');
  const failed = results.filter(result => !result.passed);
  assert.equal(failed.length, 0, JSON.stringify(failed));
  console.log(`TOS profile browser checks OK: ${results.length}/${results.length}, including mobile and no JavaScript`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
