const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { patchKeyboardAccessibility } = require('./patch_keyboard_accessibility');

const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.KEYBOARD_ACCESSIBILITY_REPORT || '.artifacts/keyboard-accessibility.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function activeElement(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    return {
      tag: node?.tagName?.toLowerCase() || '',
      id: node?.id || '',
      className: typeof node?.className === 'string' ? node.className : '',
      text: node?.textContent?.trim() || '',
      href: node?.getAttribute?.('href') || '',
      action: node?.getAttribute?.('data-action') || ''
    };
  });
}

async function testSkipLink(page) {
  await openRoute(page, '/');
  await page.keyboard.press('Tab');
  const skip = await activeElement(page);
  assert(skip.className.split(/\s+/).includes('skip-link'), `skip-link: first Tab focused ${skip.tag}#${skip.id}.${skip.className}`);

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'main');
  const main = await activeElement(page);
  assert(main.id === 'main', 'skip-link: main did not receive focus');
  assert(await page.locator('#main').getAttribute('tabindex') === '-1', 'skip-link: main is missing tabindex=-1');

  return { focused_before: skip, focused_after: main };
}

async function testMobileMenu(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/');

  const menuButton = page.locator('[data-action="menu"]');
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-action="menu"]')?.getAttribute('aria-expanded') === 'true');
  await page.waitForFunction(() => document.activeElement?.closest?.('#site-nav'));

  const openedFocus = await activeElement(page);
  assert(openedFocus.href === '/tos/', `mobile menu: expected first navigation link, received ${openedFocus.href || openedFocus.text}`);
  assert(await page.locator('#site-nav').evaluate((node) => node.classList.contains('open')), 'mobile menu: nav is not open');
  assert(await page.locator('body').evaluate((node) => node.classList.contains('menu-open')), 'mobile menu: body is missing menu-open state');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-action="menu"]')?.getAttribute('aria-expanded') === 'false');
  const closedFocus = await activeElement(page);
  assert(closedFocus.action === 'menu', `mobile menu: Escape restored focus to ${closedFocus.tag}#${closedFocus.id}`);
  assert(!await page.locator('#site-nav').evaluate((node) => node.classList.contains('open')), 'mobile menu: nav remained open after Escape');
  assert(!await page.locator('body').evaluate((node) => node.classList.contains('menu-open')), 'mobile menu: body retained menu-open after Escape');
  assert(await page.locator('body').evaluate((node) => node.style.overflow) === '', 'mobile menu: body overflow was not restored');

  return { focused_when_open: openedFocus, focused_after_escape: closedFocus };
}

async function testThemeKeyboard(page) {
  await openRoute(page, '/');
  await page.evaluate(() => {
    localStorage.removeItem('theme');
    delete document.documentElement.dataset.theme;
  });

  const themeButton = page.locator('[data-action="theme"]');
  await themeButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert(await page.evaluate(() => localStorage.getItem('theme')) === 'dark', 'theme: keyboard activation did not persist dark mode');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.documentElement.dataset.theme);
  assert(await page.evaluate(() => localStorage.getItem('theme')) === 'light', 'theme: second keyboard activation did not persist light mode');
  const focus = await activeElement(page);
  assert(focus.action === 'theme', 'theme: button lost focus after keyboard activation');

  return { focused_control: focus, stored_theme: await page.evaluate(() => localStorage.getItem('theme')) };
}

async function testCatalogTabOrder(page) {
  await openRoute(page, '/tos/');
  await page.waitForSelector('#search');
  await page.locator('#search').focus();

  const expected = ['location-filter', 'type-filter', 'trust-filter', 'sort-filter', 'reset-filters'];
  const visited = [];
  for (const id of expected) {
    await page.keyboard.press('Tab');
    const focus = await activeElement(page);
    visited.push(focus.id);
    assert(focus.id === id, `catalog tab order: expected ${id}, received ${focus.id || focus.tag}`);
  }

  await page.keyboard.press('Shift+Tab');
  const reverse = await activeElement(page);
  assert(reverse.id === 'sort-filter', `catalog reverse tab order: expected sort-filter, received ${reverse.id || reverse.tag}`);

  return { forward_order: visited, reverse_target: reverse.id };
}

async function main() {
  patchKeyboardAccessibility();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    ['skip-link-focus', { width: 1280, height: 900 }, testSkipLink],
    ['mobile-menu-focus', { width: 390, height: 844 }, testMobileMenu],
    ['theme-keyboard-toggle', { width: 1280, height: 900 }, testThemeKeyboard],
    ['catalog-tab-order', { width: 1280, height: 900 }, testCatalogTabOrder]
  ];
  const results = [];

  try {
    for (const [name, viewport, run] of scenarios) {
      const page = await browser.newPage({ viewport });
      const technicalErrors = [];
      page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

      const startedAt = Date.now();
      try {
        const details = await run(page);
        assert(technicalErrors.length === 0, `${name}: technical errors: ${technicalErrors.join(' | ')}`);
        results.push({ name, status: 'passed', duration_ms: Date.now() - startedAt, url: page.url(), details, technical_errors: [] });
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

  if (report.failed) throw new Error(`Keyboard accessibility failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`Keyboard accessibility OK: ${report.passed}/${report.total}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
