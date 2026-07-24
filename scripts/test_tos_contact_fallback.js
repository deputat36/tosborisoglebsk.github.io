const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { patchTosContactFallback, directChannels } = require('./patch_tos_contact_fallback');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.TOS_CONTACT_FALLBACK_REPORT || '.artifacts/tos-contact-fallback.json');
const TOSES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'toses.json'), 'utf8'))
  .filter((item) => item && item.slug && item.status !== 'draft');
const WITHOUT_DIRECT_CONTACT = TOSES.filter((item) => directChannels(item).length === 0);
const WITH_DIRECT_CONTACT = TOSES.filter((item) => directChannels(item).length > 0);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function testAddressedRelay(page) {
  const item = WITHOUT_DIRECT_CONTACT[0];
  assert(item, 'addressed relay: no TOS without direct contact found');
  await openRoute(page, `/tos/${item.slug}/`);

  const fallback = page.locator(`[data-tos-contact-fallback="${item.slug}"]`);
  await fallback.waitFor({ state: 'visible' });
  const link = fallback.getByRole('link', { name: 'Передать сообщение через редакцию' });
  assert(await link.getAttribute('href') === `/contacts/?tos=${item.slug}#relay-tos`, 'addressed relay: unexpected fallback URL');

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/contacts/' && url.searchParams.get('tos') === item.slug && url.hash === '#relay-tos'),
    link.click()
  ]);
  await page.waitForFunction((slug) => {
    const linkNode = document.querySelector('#relay-tos-card-link');
    return linkNode && !linkNode.hidden && linkNode.getAttribute('href') === `/tos/${slug}/`;
  }, item.slug);

  const context = (await page.locator('#relay-tos-context').textContent() || '').trim();
  const template = await page.locator('#relay-tos-template').inputValue();
  assert(context.includes(`ТОС «${item.name}»`), `addressed relay: context does not identify ${item.name}`);
  assert(context.includes('не гарантирует передачу или ответ'), 'addressed relay: response boundary is missing');
  assert(template.includes(`ТОС: ТОС «${item.name}»`), 'addressed relay: template does not identify selected TOS');
  assert(template.includes(`Карточка: https://tosborisoglebsk.ru/tos/${item.slug}/`), 'addressed relay: template is missing canonical card URL');

  return {
    slug: item.slug,
    name: item.name,
    source_route: `/tos/${item.slug}/`,
    target_route: `/contacts/?tos=${item.slug}#relay-tos`,
    context,
    template_lines: template.split('\n').length
  };
}

async function testCatalogSearchPrefilledRelay(page) {
  const query = 'улица Советская';
  const selectedLocation = 'г. Борисоглебск';
  const route = `/contacts/?request=find-tos&query=${encodeURIComponent(query)}&location=${encodeURIComponent(selectedLocation)}#relay-tos`;
  await openRoute(page, route);
  await page.waitForFunction(() => {
    const context = document.querySelector('#relay-tos-context');
    const template = document.querySelector('#relay-tos-template');
    return Boolean(context && template && context.textContent.includes('не отправлен автоматически') && template.value.includes('Поисковый запрос:'));
  });

  const context = (await page.locator('#relay-tos-context').textContent() || '').trim();
  const template = await page.locator('#relay-tos-template').inputValue();
  const returnLink = page.locator('#relay-tos-card-link');
  assert(context.includes(query), 'catalog relay: query is missing from context');
  assert(context.includes(selectedLocation), 'catalog relay: selected location is missing from context');
  assert(context.includes('не отправлен автоматически'), 'catalog relay: automatic-send boundary is missing');
  assert(context.includes('номер квартиры'), 'catalog relay: personal-data warning is missing');
  assert(template.includes(`Поисковый запрос: ${query}`), 'catalog relay: query was not prefilled');
  assert(template.includes(`Выбранная территория: ${selectedLocation}`), 'catalog relay: selected location was not prefilled');
  assert(template.includes('Что нужно уточнить: к какому ТОС относится указанная территория'), 'catalog relay: purpose line is missing');
  assert(!await returnLink.isHidden(), 'catalog relay: return link should be visible');
  assert(await returnLink.textContent() === 'Вернуться к результатам поиска ТОС', 'catalog relay: return link label is wrong');
  assert(await returnLink.getAttribute('href') === `/tos/?q=${encodeURIComponent(query)}&location=${encodeURIComponent(selectedLocation)}`, 'catalog relay: return link does not restore catalog state');

  return {
    source_route: `/tos/?q=${encodeURIComponent(query)}&location=${encodeURIComponent(selectedLocation)}`,
    target_route: route,
    context,
    template_lines: template.split('\n').length,
    return_href: await returnLink.getAttribute('href')
  };
}

async function testDirectContactNoFallback(page) {
  const item = WITH_DIRECT_CONTACT[0];
  assert(item, 'direct contact: no TOS with direct contact found');
  await openRoute(page, `/tos/${item.slug}/`);
  const fallbackCount = await page.locator('[data-tos-contact-fallback]').count();
  assert(fallbackCount === 0, `${item.slug}: editorial fallback shown despite direct public channel`);
  const contactLinks = await page.locator('a[href^="tel:"], a[href^="mailto:"], a[target="_blank"]').count();
  assert(contactLinks > 0, `${item.slug}: direct-contact sample has no rendered public links`);
  return { slug: item.slug, name: item.name, rendered_contact_links: contactLinks };
}

async function testUnknownTosGenericRelay(page) {
  await openRoute(page, '/contacts/?tos=unknown-tos-for-browser-test#relay-tos');
  await page.waitForFunction(() => {
    const context = document.querySelector('#relay-tos-context');
    return context && context.textContent.includes('не найдена');
  });
  const context = (await page.locator('#relay-tos-context').textContent() || '').trim();
  const template = await page.locator('#relay-tos-template').inputValue();
  assert(context.includes('Указанная карточка ТОС не найдена'), 'unknown relay: missing safe not-found message');
  assert(template.startsWith('ТОС или территория:'), 'unknown relay: generic template was not restored');
  assert(await page.locator('#relay-tos-card-link').isHidden(), 'unknown relay: card link should remain hidden');
  return { context, template_lines: template.split('\n').length };
}

async function main() {
  patchTosContactFallback();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    ['addressed-editorial-relay', testAddressedRelay],
    ['catalog-search-prefilled-relay', testCatalogSearchPrefilledRelay],
    ['direct-contact-without-fallback', testDirectContactNoFallback],
    ['unknown-tos-generic-relay', testUnknownTosGenericRelay]
  ];
  const results = [];

  try {
    for (const [name, run] of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
    fallback_tos: WITHOUT_DIRECT_CONTACT.map((item) => item.slug).sort(),
    direct_contact_tos_count: WITH_DIRECT_CONTACT.length,
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (report.failed) throw new Error(`TOS contact fallback browser failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`TOS contact fallback browser OK: ${report.passed}/${report.total}, fallback TOS ${report.fallback_tos.join(', ')}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
