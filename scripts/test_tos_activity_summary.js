const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const BASE_URL = String(process.env.TOS_ACTIVITY_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.TOS_ACTIVITY_REPORT || '.artifacts/tos-activity-summary.json');
const COLLECTIONS = {
  news: { file: 'data/news.json', anchor: 'tos-news' },
  events: { file: 'data/events.json', anchor: 'tos-events' },
  projects: { file: 'data/projects.json', anchor: 'tos-projects' },
  done: { file: 'data/done.json', anchor: 'tos-done' },
  needs: { file: 'data/needs.json', anchor: 'tos-needs' }
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function published(item) {
  return item && item.status !== 'draft';
}

function countFor(items, slug) {
  return (Array.isArray(items) ? items : []).filter((item) => published(item) && item.tos_slug === slug).length;
}

function buildCases() {
  const toses = readJson('data/toses.json').filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const data = Object.fromEntries(Object.entries(COLLECTIONS).map(([key, config]) => [key, readJson(config.file)]));
  const rows = toses.map((tos) => {
    const counts = Object.fromEntries(Object.keys(COLLECTIONS).map((key) => [key, countFor(data[key], tos.slug)]));
    return { slug: tos.slug, name: tos.name, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
  }).sort((a, b) => b.total - a.total || String(a.slug).localeCompare(String(b.slug)));

  assert(rows.length > 0, 'activity summary: no published TOS pages');
  const selected = [rows[0], rows[rows.length - 1]].filter((item, index, list) => list.findIndex((candidate) => candidate.slug === item.slug) === index);
  return selected;
}

async function verifyCase(browser, item) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const technicalErrors = [];
  page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

  try {
    const response = await page.goto(`${BASE_URL}/tos/${item.slug}/`, { waitUntil: 'networkidle' });
    assert(response && response.ok(), `${item.slug}: HTTP ${response ? response.status() : 'no response'}`);
    await page.waitForSelector('#tos-activity-summary[data-tos-activity-summary]');

    const dataset = await page.locator('#tos-activity-summary').evaluate((node) => ({ ...node.dataset }));
    assert(dataset.tosSlug === item.slug, `${item.slug}: wrong summary slug ${dataset.tosSlug}`);
    assert(Number(dataset.totalCount) === item.total, `${item.slug}: total ${dataset.totalCount} !== ${item.total}`);

    for (const [key, config] of Object.entries(COLLECTIONS)) {
      const expected = item.counts[key];
      const datasetKey = `${key}Count`;
      assert(Number(dataset[datasetKey]) === expected, `${item.slug}: ${key} ${dataset[datasetKey]} !== ${expected}`);

      const tile = page.locator(`[data-activity-key="${key}"]`);
      assert(await tile.count() === 1, `${item.slug}: expected one ${key} tile`);
      const tagName = await tile.evaluate((node) => node.tagName);
      if (expected > 0) {
        assert(tagName === 'A', `${item.slug}: populated ${key} tile is not a link`);
        assert(await tile.getAttribute('href') === `#${config.anchor}`, `${item.slug}: wrong ${key} anchor`);
        assert(await page.locator(`#${config.anchor}`).count() === 1, `${item.slug}: missing ${key} target section`);
      } else {
        assert(tagName === 'DIV', `${item.slug}: zero ${key} tile must not link to a hidden section`);
      }
    }

    const notice = await page.locator('[data-activity-summary-notice]').innerText();
    assert(notice.includes('Ноль не означает отсутствие работы ТОС'), `${item.slug}: neutral zero explanation is missing`);
    assert(notice.includes('материалы в базе портала'), `${item.slug}: portal scope explanation is missing`);

    const firstLinkedTile = page.locator('#tos-activity-summary a[data-activity-key]').first();
    if (await firstLinkedTile.count()) {
      const href = await firstLinkedTile.getAttribute('href');
      await firstLinkedTile.click();
      await page.waitForFunction((expectedHash) => location.hash === expectedHash, href);
      assert(await page.locator(href).count() === 1, `${item.slug}: clicked summary target is missing`);
    }

    assert(technicalErrors.length === 0, `${item.slug}: technical errors: ${technicalErrors.join(' | ')}`);
    return { slug: item.slug, name: item.name, total: item.total, counts: item.counts, status: 'passed', url: page.url() };
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const cases = buildCases();
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const item of cases) {
      try {
        results.push(await verifyCase(browser, item));
        console.log(`PASS tos-activity-summary ${item.slug}: ${item.total}`);
      } catch (error) {
        results.push({ slug: item.slug, name: item.name, total: item.total, counts: item.counts, status: 'failed', error: error.message });
        console.error(`FAIL tos-activity-summary ${item.slug}: ${error.message}`);
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

  if (report.failed) throw new Error(`TOS activity summary browser test failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`TOS activity summary browser test OK: ${report.passed}/${report.total}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
