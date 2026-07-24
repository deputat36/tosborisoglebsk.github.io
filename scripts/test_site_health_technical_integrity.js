const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.SITE_HEALTH_INTEGRITY_REPORT || '.artifacts/site-health-integrity.json');
const SITE_HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openPage(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function overflowDiagnostics(page) {
  return page.evaluate(() => {
    const section = document.querySelector('#site-health-integrity-section');
    if (!section) return [{ tag: 'section', id: 'site-health-integrity-section', error: 'missing' }];
    const sectionRect = section.getBoundingClientRect();
    const leftBoundary = Math.max(0, sectionRect.left) - 1;
    const rightBoundary = Math.min(document.documentElement.clientWidth, sectionRect.right) + 1;
    return Array.from(section.querySelectorAll('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
        };
      })
      .filter((item) => item.width > 0 && (item.left < leftBoundary || item.right > rightBoundary))
      .slice(0, 12);
  });
}

async function main() {
  assert(fs.existsSync(SITE_HEALTH_PATH), `Missing ${SITE_HEALTH_PATH}`);
  const report = JSON.parse(fs.readFileSync(SITE_HEALTH_PATH, 'utf8'));
  const integrity = report.technical_integrity;
  assert(integrity && integrity.status === 'passed', 'technical_integrity must be generated and passed');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of [
      { name: 'desktop', width: 1180, height: 900 },
      { name: 'mobile', width: 360, height: 800 }
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const technicalErrors = [];
      page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

      const startedAt = Date.now();
      try {
        await openPage(page, '/site-health/#site-health-integrity-section');
        await page.locator('[data-integrity-metrics]').waitFor({ state: 'visible' });

        const section = page.locator('#site-health-integrity-section');
        const text = (await section.textContent() || '').replace(/\s+/g, ' ');
        assert(text.includes(`${integrity.failed} ошибок`), `${viewport.name}: failed counter is not rendered`);
        assert(text.includes(String(integrity.pages_checked)), `${viewport.name}: pages_checked is not rendered`);
        assert(text.includes(String(integrity.internal_links_checked)), `${viewport.name}: internal_links_checked is not rendered`);
        assert(text.includes(String(integrity.unique_internal_targets)), `${viewport.name}: unique_internal_targets is not rendered`);
        assert(text.includes('Что она не подтверждает'), `${viewport.name}: factual boundary is missing`);
        assert(text.includes('актуальность председателей'), `${viewport.name}: TOS factual boundary is missing`);
        assert(text.includes('GitHub Pages'), `${viewport.name}: Pages boundary is missing`);

        const reportLink = section.getByRole('link', { name: 'Открыть JSON проверки' });
        assert(await reportLink.getAttribute('href') === '/data/public_link_integrity.json', `${viewport.name}: report link is incorrect`);
        const overflow = await overflowDiagnostics(page);
        assert(overflow.length === 0, `${viewport.name}: integrity section has horizontal overflow: ${JSON.stringify(overflow)}`);
        assert(technicalErrors.length === 0, `${viewport.name}: technical errors: ${technicalErrors.join(' | ')}`);

        results.push({
          viewport: viewport.name,
          status: 'passed',
          duration_ms: Date.now() - startedAt,
          metrics: {
            pages_checked: integrity.pages_checked,
            internal_links_checked: integrity.internal_links_checked,
            unique_internal_targets: integrity.unique_internal_targets,
            browser_suites_enabled: integrity.automation?.browser_suites_enabled,
            visual_cases: integrity.automation?.visual_cases
          },
          overflow: [],
          technical_errors: []
        });
        console.log(`PASS site-health-integrity-${viewport.name}`);
      } catch (error) {
        const overflow = await overflowDiagnostics(page).catch(() => []);
        results.push({ viewport: viewport.name, status: 'failed', duration_ms: Date.now() - startedAt, error: error.message, overflow, technical_errors: technicalErrors });
        console.error(`FAIL site-health-integrity-${viewport.name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const output = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  if (output.failed) throw new Error(`Site health technical integrity browser failed: ${output.failed} of ${output.total}`);
  console.log(`Site health technical integrity browser OK: ${output.passed}/${output.total}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
