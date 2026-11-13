const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const BASE = process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173';
const OUT = '.artifacts/visual-baseline/resident-area';
fs.mkdirSync(OUT, {recursive: true});
const report = {scenarios: [], errors: []};
async function go(page, route) { const response = await page.goto(BASE + route, {waitUntil: 'networkidle'}); assert(response.ok(), route); }
async function fit(page, name) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' fits viewport'); }
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({viewport: {width, height: 900}, acceptDownloads: true});
      await context.addInitScript(() => {
        const OriginalDate = Date;
        window.Date = class extends OriginalDate {
          constructor(...args) { super(...(args.length ? args : ['2026-11-13T10:00:00Z'])); }
          static now() { return new OriginalDate('2026-11-13T10:00:00Z').getTime(); }
        };
      });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      // Network data failures must not block a ready embedded catalog.
      await page.route('**/data/*.json', route => route.abort());
      await go(page, '/residents/my-area/?tos=chkalovec');
      assert.equal(await page.locator('#area-choice').inputValue(), 'chkalovec');
      assert((await page.locator('.area-summary').innerText()).includes('Чкаловец'));
      assert((await page.locator('#area-done-title').locator('..').locator('..').innerText()).includes('Цветик-семицветик'));
      assert.equal(await page.locator('[data-area-dashboard] a[href*="tos=chkalovec&type=project"]').count(), 1);
      await page.locator('[data-area-save]').click();
      await go(page, '/residents/my-area/');
      assert.equal(await page.locator('#area-choice').inputValue(), 'chkalovec');
      assert(new URL(page.url()).searchParams.get('tos') === 'chkalovec');
      await go(page, '/residents/my-area/?tos=uyutnyy');
      assert.equal(await page.locator('#area-choice').inputValue(), 'uyutnyy', 'Explicit URL overrides saved choice');
      await page.locator('#area-search').fill('Макашевка');
      await page.locator('[data-area-choose="makashevka"]').click();
      assert.equal(await page.locator('#area-choice').inputValue(), 'makashevka');
      await page.locator('#area-help-kind').selectOption('materials');
      assert(new URL(page.url()).searchParams.get('help') === 'materials');
      assert((await page.locator('#area-help').innerText()).includes('Подтверждённых актуальных запросов'));
      await page.locator('.area-ideas summary').click();
      assert.equal(await page.locator('.area-ideas .tag').filter({hasText: 'Актуальность подтверждена'}).count(), 0);
      await page.locator('.area-share summary').click();
      assert((await page.locator('[data-area-share-link]').inputValue()).includes('tos=makashevka&help=materials'));
      await fit(page, 'territory ' + width);
      await page.evaluate(() => {document.activeElement?.blur(); window.scrollTo(0, 0);});
      await page.screenshot({path: path.join(OUT, 'area-' + width + '.png')});
      const calendarButton = page.locator('[data-area-calendar]').first();
      assert(await calendarButton.isVisible(), 'Current common deadlines are available');
      const downloadPromise = page.waitForEvent('download');
      await calendarButton.click();
      const download = await downloadPromise;
      const target = path.join(OUT, 'calendar-' + width + '.ics'); await download.saveAs(target);
      const calendar = fs.readFileSync(target, 'utf8');
      assert(calendar.includes('BEGIN:VCALENDAR\r\n'));
      assert(calendar.includes('DTSTART;VALUE=DATE:'));
      assert(!calendar.includes('TRIGGER:'));
      await page.getByRole('link', {name: 'Мусор не вывезен или площадка загрязнена', exact: false}).click();
      assert.equal(await page.locator('#zhkh-issue').inputValue(), 'waste');
      assert.equal(await page.locator('[data-zhkh-case]:visible').count(), 1);
      assert(await page.locator('[data-zhkh-case="waste"] details').evaluate(element => element.open));
      await page.locator('#zhkh-housing').selectOption('house');
      await page.reload({waitUntil: 'networkidle'});
      assert.equal(await page.locator('#zhkh-housing').inputValue(), 'house');
      assert.equal(await page.locator('#zhkh-issue').inputValue(), 'waste');
      await fit(page, 'housing route ' + width);
      report.scenarios.push('selection, saving, explicit link, search, help filter, share, calendar, housing ' + width);
      await context.close();
    }
    const blocked = await browser.newContext({viewport: {width: 390, height: 900}});
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() {throw new Error('unavailable');}}));
    const safe = await blocked.newPage(); safe.on('pageerror', error => report.errors.push(error.message));
    await go(safe, '/residents/my-area/?tos=uyutnyy');
    await safe.locator('[data-area-save]').click();
    assert((await safe.locator('[data-area-status]').innerText()).includes('не разрешил сохранить'));
    await safe.locator('#area-choice').selectOption('bogana');
    assert.equal(await safe.locator('#area-choice').inputValue(), 'bogana');
    await go(safe, '/residents/my-area/?tos=not-a-tos');
    assert.equal(await safe.locator('#area-choice').inputValue(), '');
    assert((await safe.locator('[data-area-status]').innerText()).includes('нет в каталоге'));
    report.scenarios.push('blocked storage and unknown URL preserve selection and honest messages');
    await blocked.close();
    const nojs = await browser.newContext({viewport: {width: 320, height: 900}, javaScriptEnabled: false});
    const plain = await nojs.newPage(); await go(plain, '/residents/my-area/');
    assert.equal(await plain.locator('.area-directory a').count(), JSON.parse(fs.readFileSync('data/toses.json')).length);
    assert(await plain.locator('.area-directory').isVisible());
    assert.equal(await plain.locator('[data-area-controls]').isVisible(), false);
    assert(await plain.getByRole('link', {name: 'Официальные ссылки и службы БГО'}).isVisible());
    await fit(plain, 'no scripts'); report.scenarios.push('no-script full directory and official help');
    await nojs.close();
    assert.deepEqual(report.errors, []); report.passed = true;
  } finally { await browser.close(); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {console.error(error); process.exitCode = 1;});
