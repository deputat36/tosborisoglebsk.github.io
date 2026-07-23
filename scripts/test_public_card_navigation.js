const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.PUBLIC_CARD_NAVIGATION_REPORT || '.artifacts/public-card-navigation.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function testCardNavigation(page, config) {
  await openRoute(page, config.route);
  const link = page.locator(config.linkSelector).first();
  await link.waitFor({ state: 'visible' });

  const href = await link.getAttribute('href');
  assert(href, `${config.name}: primary card link has no href`);
  assert(href.startsWith(config.expectedPrefix), `${config.name}: unexpected destination ${href}`);
  assert(!href.includes('?') && !href.includes('#'), `${config.name}: primary detail link must use a canonical path: ${href}`);

  const card = link.locator('xpath=ancestor::article[1]');
  const sourceTitle = (await card.locator('h3').first().textContent() || '').trim();
  assert(sourceTitle, `${config.name}: source card title is missing`);

  await Promise.all([
    page.waitForURL((url) => url.pathname === href),
    link.click()
  ]);

  const destinationTitle = (await page.locator('main h1').first().textContent() || '').trim();
  assert(destinationTitle, `${config.name}: destination h1 is missing at ${href}`);
  assert(
    normalize(destinationTitle).includes(normalize(sourceTitle)) || normalize(sourceTitle).includes(normalize(destinationTitle)),
    `${config.name}: destination title does not match card title: "${sourceTitle}" -> "${destinationTitle}"`
  );

  return {
    name: config.name,
    source_route: config.route,
    destination_path: href,
    source_title: sourceTitle,
    destination_title: destinationTitle
  };
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    {
      name: 'global-search-result',
      route: '/search/?q=%D0%9C%D0%B8%D1%80%D0%BE%D0%BB%D1%8E%D0%B1%D0%B8%D0%B5&type=news&origin=verified&sort=title',
      linkSelector: '#search-results .search-result[data-search-group="news"][data-content-origin="verified"] .btn.primary[href^="/news/"]',
      expectedPrefix: '/news/'
    },
    {
      name: 'tos-catalog-card',
      route: '/tos/?q=%D0%9C%D0%B8%D1%80%D0%BE%D0%BB%D1%8E%D0%B1%D0%B8%D0%B5',
      linkSelector: '#tos-list .improved-tos-card .btn.primary[href^="/tos/"]',
      expectedPrefix: '/tos/'
    },
    {
      name: 'news-card',
      route: '/news/?origin=verified',
      linkSelector: '#news-feed [data-content-origin="verified"] .btn.primary[href^="/news/"]',
      expectedPrefix: '/news/'
    },
    {
      name: 'project-card',
      route: '/projects/?origin=starter',
      linkSelector: '#projects-list [data-content-origin="starter"] .btn.primary[href^="/projects/"]',
      expectedPrefix: '/projects/'
    },
    {
      name: 'done-card',
      route: '/done/?origin=request',
      linkSelector: '#done-list [data-content-origin="request"] .btn.primary[href^="/done/"]',
      expectedPrefix: '/done/'
    },
    {
      name: 'need-card',
      route: '/needs/?origin=request',
      linkSelector: '#needs-list [data-content-origin="request"] .btn.primary[href^="/needs/"]',
      expectedPrefix: '/needs/'
    }
  ];

  const results = [];
  try {
    for (const config of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const technicalErrors = [];
      page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

      const startedAt = Date.now();
      try {
        const navigation = await testCardNavigation(page, config);
        assert(technicalErrors.length === 0, `${config.name}: technical errors: ${technicalErrors.join(' | ')}`);
        results.push({
          ...navigation,
          status: 'passed',
          duration_ms: Date.now() - startedAt,
          technical_errors: technicalErrors
        });
        console.log(`PASS ${config.name}: ${navigation.destination_path}`);
      } catch (error) {
        results.push({
          name: config.name,
          source_route: config.route,
          status: 'failed',
          duration_ms: Date.now() - startedAt,
          url: page.url(),
          error: error.message,
          technical_errors: technicalErrors
        });
        console.error(`FAIL ${config.name}: ${error.message}`);
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

  if (report.failed) throw new Error(`Public card navigation failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`Public card navigation OK: ${report.passed}/${report.total}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
